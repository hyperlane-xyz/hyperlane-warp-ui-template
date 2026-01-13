const CACHE_NAME = 'static-assets-v2';
const ASSET_EXTENSIONS = ['.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.otf'];
const MAX_CACHE_BYTES = 5 * 1024 * 1024;
const METADATA_REQUEST = new Request(`${self.location.origin}/__sw-cache-metadata__`);

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((staleKey) => caches.delete(staleKey)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!shouldHandleRequest(request)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          const size = await getResponseSize(networkResponse.clone());
          await cache.put(request, networkResponse.clone());
          await recordEntrySize(cache, request, size);
          await enforceCacheLimit(cache);
        }
        return networkResponse;
      } catch (error) {
        return cachedResponse ?? Promise.reject(error);
      }
    }),
  );
});

function shouldHandleRequest(request) {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isApiRoute = url.pathname.startsWith('/api');
  if (!isSameOrigin || isApiRoute) {
    return false;
  }

  return ASSET_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

async function getResponseSize(response) {
  const declaredSize = response.headers.get('content-length');
  if (declaredSize && !Number.isNaN(Number(declaredSize))) {
    return Number(declaredSize);
  }

  const buffer = await response.arrayBuffer();
  return buffer.byteLength;
}

async function readMetadata(cache) {
  const response = await cache.match(METADATA_REQUEST);
  if (!response) {
    return { totalSize: 0, sizes: {} };
  }

  try {
    return await response.json();
  } catch {
    return { totalSize: 0, sizes: {} };
  }
}

async function writeMetadata(cache, metadata) {
  await cache.put(
    METADATA_REQUEST,
    new Response(JSON.stringify(metadata), {
      headers: { 'content-type': 'application/json' },
    }),
  );
}

async function recordEntrySize(cache, request, size) {
  const metadata = await readMetadata(cache);
  const previousSize = metadata.sizes[request.url] || 0;

  metadata.totalSize = metadata.totalSize - previousSize + size;
  metadata.sizes[request.url] = size;

  await writeMetadata(cache, metadata);
}

async function enforceCacheLimit(cache) {
  let metadata = await readMetadata(cache);
  if (metadata.totalSize <= MAX_CACHE_BYTES) {
    return;
  }

  const keys = await cache.keys();
  for (const key of keys) {
    if (key.url === METADATA_REQUEST.url) {
      continue;
    }

    await cache.delete(key);

    const entrySize = metadata.sizes[key.url] || 0;
    metadata.totalSize -= entrySize;
    delete metadata.sizes[key.url];

    if (metadata.totalSize <= MAX_CACHE_BYTES) {
      break;
    }
  }

  await writeMetadata(cache, metadata);
}
