import * as fs from 'fs';
import * as path from 'path';

import ApiGenerator from 'oazapfts/lib/codegen/generate';
import { OpenAPIV3 } from 'openapi-types';

import { getV3Doc } from './swagger';
import { prettify, toExpressLikePath } from './utils';
import { OperationCollection, transformToApiHandlerCode } from './transform';
import { mockApiTemplate, mockTemplate } from './template';
import { CliOptions, ImportFilePathType } from './types';
import { camelCase } from 'change-case';

export async function generate(spec: string, options: CliOptions) {
  const { output: outputFile } = options;
  let code: string;
  const apiDoc = await getV3Doc(spec);
  const apiGen = new ApiGenerator(apiDoc, {});

  const operationDefinitions = getOperationDefinitions(apiDoc);
  const includes = options?.includes?.split(',') ?? null;
  const excludes = options?.excludes?.split(',') ?? null;
  const operationCollection: OperationCollection[] = operationDefinitions
    .filter(op => {
      if (includes && !includes.includes(op.path)) {
        return false;
      }
      if (excludes && excludes.includes(op.path)) {
        return false;
      }
      return true;
    })
    .map(operationDefinition => {
      const { verb, path, responses } = operationDefinition;

      const responseMap = Object.entries(responses).map(([code, response]) => {
        const content = apiGen.resolve(response).content;
        if (!content) {
          return { code };
        }

        const resolvedResponse = Object.keys(content).reduce(
          (resolved, type) => {
            const schema = content[type].schema;
            if (typeof schema !== 'undefined') {
              resolved[type] = recursiveResolveSchema(schema);
            }

            return resolved;
          },
          {} as Record<string, OpenAPIV3.SchemaObject>
        );
        return {
          code,
          responses: resolvedResponse,
        };
      });

      return {
        verb,
        path: toExpressLikePath(path),
        responseMap,
      };
    });

  let baseURL = '';
  if (options.baseUrl === true) {
    baseURL = getServerUrl(apiDoc);
  } else if (typeof options.baseUrl === 'string') {
    baseURL = options.baseUrl;
  }

  const filePaths: ImportFilePathType[] = []; // api paths

  if (outputFile && operationCollection) {
    const dirPath = path.dirname(outputFile);
    const ext = path.extname(outputFile);

    const mockApiDirPath = `${dirPath}/mockApi`;
    const isExistMockApiDir = fs.existsSync(mockApiDirPath);

    // create mockApi dir
    if (isExistMockApiDir) {
      fs.rmdirSync(mockApiDirPath, { recursive: true });
    }
    fs.mkdirSync(`${dirPath}/mockApi`);

    for (const value of operationCollection) {
      const apiHandlerName = camelCase(`${value.verb}_${value.path}`);

      const code = mockApiTemplate(
        apiHandlerName,
        transformToApiHandlerCode(value)
      );

      const apiFileName = `${apiHandlerName}.mock${ext}`;
      const filePath = `${dirPath}/mockApi/${apiFileName}`;

      // seperate each api file
      fs.writeFileSync(
        path.resolve(process.cwd(), filePath),
        await prettify(filePath, code)
      );
      filePaths.push({
        fileName: apiFileName.replace(path.extname(apiFileName), ''),
        apiHandlerName: apiHandlerName,
      });
    }
  } else {
    console.log("No output file specified, won't generate mock files");
  }

  // generate handler output file
  code = mockTemplate(baseURL, filePaths, options);
  fs.writeFileSync(
    path.resolve(process.cwd(), outputFile),
    await prettify(outputFile, code)
  );

  function recursiveResolveSchema(
    schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
  ) {
    const resolvedSchema = apiGen.resolve(schema) as OpenAPIV3.SchemaObject;

    if (resolvedSchema.type === 'array') {
      resolvedSchema.items = apiGen.resolve(resolvedSchema.items);
      resolvedSchema.items = recursiveResolveSchema(resolvedSchema.items);
    } else if (resolvedSchema.type === 'object') {
      if (
        !resolvedSchema.properties &&
        typeof resolvedSchema.additionalProperties === 'object'
      ) {
        if ('$ref' in resolvedSchema.additionalProperties) {
          resolvedSchema.additionalProperties = recursiveResolveSchema(
            apiGen.resolve(resolvedSchema.additionalProperties)
          );
        }
      }

      if (resolvedSchema.properties) {
        resolvedSchema.properties = Object.entries(
          resolvedSchema.properties
        ).reduce((resolved, [key, value]) => {
          resolved[key] = recursiveResolveSchema(value);
          return resolved;
        }, {} as Record<string, OpenAPIV3.SchemaObject>);
      }
    }

    return resolvedSchema;
  }
}

function getServerUrl(apidoc: OpenAPIV3.Document) {
  let server = apidoc.servers?.at(0);
  let url = '';
  if (server) {
    url = server.url;
  }
  if (server?.variables) {
    Object.entries(server.variables).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, value.default);
    });
  }

  return url;
}

const operationKeys = Object.values(
  OpenAPIV3.HttpMethods
) as OpenAPIV3.HttpMethods[];

type OperationDefinition = {
  path: string;
  verb: string;
  responses: OpenAPIV3.ResponsesObject;
};

function getOperationDefinitions(
  v3Doc: OpenAPIV3.Document
): OperationDefinition[] {
  return Object.entries(v3Doc.paths).flatMap(([path, pathItem]) =>
    !pathItem
      ? []
      : Object.entries(pathItem)
          .filter((arg): arg is [string, OpenAPIV3.OperationObject] =>
            operationKeys.includes(arg[0] as any)
          )
          .map(([verb, operation]) => ({
            path,
            verb,
            responses: operation.responses,
          }))
  );
}
