import serverModule from '../backend/server.js';

const { handler } = serverModule;

export default async function vercelHandler(req, res) {
  const rawPath = req.query?.path;
  const apiPath = Array.isArray(rawPath)
    ? rawPath.join('/')
    : String(rawPath || '').replace(/^\/+|\/+$/g, '');

  const currentUrl = new URL(req.url || '/api/index', 'http://localhost');
  currentUrl.searchParams.delete('path');
  const query = currentUrl.searchParams.toString();

  req.url = `/api/${apiPath}${query ? `?${query}` : ''}`;
  return handler(req, res);
}
