// Service worker companion script for Web Share Target handling
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('file');
          if (file) {
            const cache = await caches.open('cadstudio-shared-cache');
            await cache.put(
              '/shared-model-data',
              new Response(file, {
                headers: {
                  'content-type': file.type || 'application/octet-stream',
                  'x-shared-name': encodeURIComponent(file.name || 'shared_model.glb'),
                },
              })
            );
          }
        } catch (err) {
          console.error('Error processing shared file:', err);
        }
        return Response.redirect('/?shared=1', 303);
      })()
    );
  }
});
