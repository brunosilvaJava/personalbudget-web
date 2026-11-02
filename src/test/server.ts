import { setupServer } from 'msw/node'

/** Fake API for tests. Each test adds its own handlers with server.use(...). */
export const server = setupServer()
