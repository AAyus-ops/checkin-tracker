self.addEventListener('push', function (event) {
  var payload = event.data ? event.data.text() : '该打卡啦！';
  event.waitUntil(self.registration.showNotification('打卡监督', {
    body: payload,
    tag: 'checkin-reminder',
    renotify: true
  }));
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    var i;
    for (i = 0; i < list.length; i++) {
      if ('focus' in list[i]) { list[i].focus(); return undefined; }
    }
    return clients.openWindow(self.registration.scope);
  }));
});
