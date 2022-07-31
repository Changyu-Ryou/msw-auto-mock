/**
 * This file is AUTO GENERATED by [msw-auto-mock](https://github.com/zoubingwu/msw-auto-mock)
 * Feel free to commit/edit it as you need.
 */
/* eslint-disable */
/* tslint:disable */
import { setupWorker, rest } from 'msw';
import { faker } from '@faker-js/faker';
import { get__ } from './mockApi/get__.mock';
import { get__admin_hooks } from './mockApi/get__admin_hooks.mock';
import { post__admin_hooks } from './mockApi/post__admin_hooks.mock';
import { get__admin_hooks_hookId } from './mockApi/get__admin_hooks_hookId.mock';
import { patch__admin_hooks_hookId } from './mockApi/patch__admin_hooks_hookId.mock';
import { delete__admin_hooks_hookId } from './mockApi/delete__admin_hooks_hookId.mock';

faker.seed(1);

export const baseURL = '';
export const MAX_ARRAY_LENGTH = 20;

let i = 0;
export const next = () => {
  if (i === Number.MAX_SAFE_INTEGER - 1) {
    i = 0;
  }
  return i++;
};

export const handlers = [
  ...get__,
  ...get__admin_hooks,
  ...post__admin_hooks,
  ...get__admin_hooks_hookId,
  ...patch__admin_hooks_hookId,
  ...delete__admin_hooks_hookId,
];

// This configures a Service Worker with the given request handlers.
export const startWorker = () => {
  if (typeof window === 'undefined') {
    const { setupServer } = require('msw/node');
    const server = setupServer(...handlers);
    server.listen();
  } else {
    const worker = setupWorker(...handlers);
    worker.start();
  }
};
