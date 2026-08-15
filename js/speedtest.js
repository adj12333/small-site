// 网速测试：测量到本站的延迟与下载速度
(function () {
  var pingValueEl = document.getElementById('ping-value');
  var dlValueEl = document.getElementById('dl-value');
  var btn = document.getElementById('btn-test');
  var statusEl = document.getElementById('st-status');
  var barEl = document.getElementById('st-progress-bar');

  var PING_URL = '../index.html';
  var DOWNLOAD_URL = '../speedtest/100mb.bin';
  var FILE_SIZE = 104857600; // 100MB
  var TEST_TIME_LIMIT = 5000; // 下载测试 5 秒上限，弱网下避免长时间下载
  var PING_COUNT = 5;

  function cacheBust(url) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + '_t=' + Date.now() + '-' + Math.random();
  }

  function toMbps(bytes, seconds) {
    if (!seconds) return 0;
    return (bytes * 8) / seconds / 1000000;
  }

  function testPing() {
    statusEl.textContent = '正在测试延迟…';
    var tasks = [];
    for (var i = 0; i < PING_COUNT; i++) {
      tasks.push((function () {
        var start = performance.now();
        return fetch(cacheBust(PING_URL), { cache: 'no-store' })
          .then(function () { return performance.now() - start; })
          .catch(function () { return -1; });
      })());
    }
    return Promise.all(tasks).then(function (times) {
      var valid = times.filter(function (t) { return t >= 0; });
      if (!valid.length) throw new Error('ping failed');
      var sum = valid.reduce(function (a, b) { return a + b; }, 0);
      return sum / valid.length;
    });
  }

  function testDownload(onProgress) {
    statusEl.textContent = '正在测试下载速度…';
    var start = performance.now();
    var controller = new AbortController();
    var received = 0;
    var timedOut = false;

    var timer = setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, TEST_TIME_LIMIT);

    function finish() {
      clearTimeout(timer);
      var sec = (performance.now() - start) / 1000;
      return { mbps: toMbps(received, sec), timedOut: timedOut };
    }

    return fetch(cacheBust(DOWNLOAD_URL), { cache: 'no-store', signal: controller.signal })
      .then(function (resp) {
        if (!resp.ok) throw new Error('download failed');

        if (resp.body && typeof resp.body.getReader === 'function') {
          var reader = resp.body.getReader();
          var total = Number(resp.headers.get('content-length')) || FILE_SIZE;

          function read() {
            return reader.read().then(function (result) {
              if (result.done) {
                return finish();
              }
              received += result.value.length;
              var sec = (performance.now() - start) / 1000;
              onProgress(received / total, toMbps(received, sec));
              return read();
            }).catch(function (e) {
              // 5 秒到点被中止：返回当前已测速度
              if (timedOut) return finish();
              throw e;
            });
          }
          return read();
        }

        // 回退：不支持流式读取时一次性读取
        return resp.arrayBuffer().then(function (buf) {
          received = buf.byteLength;
          onProgress(1, toMbps(received, (performance.now() - start) / 1000));
          return finish();
        }).catch(function (e) {
          if (timedOut) return finish();
          throw e;
        });
      })
      .catch(function (e) {
        if (timedOut) return finish();
        throw e;
      });
  }

  function run() {
    btn.disabled = true;
    pingValueEl.textContent = '…';
    dlValueEl.textContent = '…';
    barEl.style.width = '0%';
    statusEl.textContent = '准备中…';

    testPing()
      .then(function (ms) {
        pingValueEl.textContent = Math.round(ms);
        return testDownload(function (progress, mbps) {
          barEl.style.width = Math.round(progress * 100) + '%';
          dlValueEl.textContent = mbps.toFixed(2);
        });
      })
      .then(function (r) {
        dlValueEl.textContent = r.mbps.toFixed(2);
        statusEl.textContent = r.timedOut ? '测试完成（已达 5 秒上限）' : '测试完成';
      })
      .catch(function () {
        statusEl.textContent = '测试失败：请通过 HTTP 方式访问本站（file:// 下无法测速）';
      })
      .then(function () {
        btn.disabled = false;
      });
  }

  btn.addEventListener('click', run);
})();
