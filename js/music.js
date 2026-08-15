// 音乐播放器：本地手动添加 + 在线搜索（默认音源 Meting / 网易云）
// 在线音源地址可替换，见 METING_API
(function () {
  var STORAGE_KEY = 'music-user-songs';
  var METING_API = 'https://api.i-meto.com/meting/api';

  var audio = new Audio();
  audio.crossOrigin = 'anonymous';  // 以 CORS 模式加载跨域音频，否则 createMediaElementSource 输出静音
  audio.setAttribute('playsinline', '');         // iOS 后台/内联播放
  audio.setAttribute('webkit-playsinline', '');  // 兼容旧版 iOS
  var currentIndex = -1;       // 本地歌曲索引；-1 表示未在播本地歌曲
  var currentOnline = -1;      // 在线歌曲索引；-1 表示未在播在线歌曲
  var userSongs = loadUserSongs();
  var onlineResults = [];      // 在线搜索结果（Meting 原始结构）
  var searchTimer = null;
  var searching = false;
  var searchAbort = null;   // 取消过期搜索请求，避免快速输入时旧结果覆盖新结果

  var searchEl = document.getElementById('music-search');
  var sourceEl = document.getElementById('music-source');
  var resolveSourceEl = document.getElementById('music-resolve-source');
  var playlistEl = document.getElementById('playlist');
  var npTitle = document.getElementById('np-title');
  var npArtist = document.getElementById('np-artist');
  var playBtn = document.getElementById('btn-play');
  var prevBtn = document.getElementById('btn-prev');
  var nextBtn = document.getElementById('btn-next');
  var seekBar = document.getElementById('seek-bar');
  var curTimeEl = document.getElementById('cur-time');
  var durTimeEl = document.getElementById('dur-time');
  var addForm = document.getElementById('add-song-form');
  var titleEl = document.getElementById('song-title');
  var artistEl = document.getElementById('song-artist');
  var urlEl = document.getElementById('song-url');
  var moreBtn = document.getElementById('btn-more');
  var moreMenu = document.getElementById('more-menu');
  var qualityList = document.getElementById('quality-list');
  var spatialToggle = document.getElementById('spatial-toggle');
  var multichannelToggle = document.getElementById('multichannel-toggle');
  var loopToggle = document.getElementById('loop-toggle');
  var visualizer = document.getElementById('visualizer');
  // 生成 64 根圆周竖条（圆形可视化，角度由 JS 计算）
  for (var b = 0; b < 64; b++) {
    var barEl = document.createElement('span');
    barEl.className = 'bar';
    visualizer.appendChild(barEl);
  }
  var analyser = null;
  var analyserData = null;
  var spectrumRafId = null;
  var barFallbackTimer = null;

  var PLAY_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>';
  var PAUSE_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"></path></svg>';
  var DOWNLOAD_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14"></path></svg>';

  // 当前播放歌曲信息（用于音质探测与多声道判断）
  var nowPlaying = { type: null, baseUrl: '', server: '', title: '', artist: '' };
  var currentQualityKey = '';  // 当前播放音质的标识（用于框选）
  var infoAbort = null;        // 取消上一次「当前歌曲音质」探测请求
  var playToken = 0;           // 切歌序号，防止快速切歌时旧解析结果覆盖新歌曲
  var resolveAbort = null;     // 取消上一次「播放地址解析」请求

  // 各音源支持的音质档位（br 参数值）
  var QUALITY_LEVELS = {
    netease: ['128', '192', '320', '999'],
    tencent: ['128', '320', 'flac'],
    kugou: ['128', '320', 'flac']
  };

  // Web Audio 处理链：audio → mediaSource → [单声道合并] → panner → destination
  var audioCtx = null;
  var mediaSource = null;
  var panner = null;
  var monoNodes = null;
  var spatialOn = false;      // 空间音效（左右声道摆动）
  var monoOn = false;         // 单声道合并（多声道开关关闭时）
  var loopOn = false;         // 单曲循环
  var panLfoId = null;

  function loadUserSongs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) {
      // 隐私模式下 localStorage 可能不可用，忽略
    }
    return [];
  }

  function saveUserSongs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userSongs));
    } catch (e) {
      // 忽略持久化失败，本次会话仍可用
    }
  }

  function safePlay() {
    var p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () {
        // 自动播放被拦截等情况，忽略
      });
    }
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  // ---------- Web Audio 处理（空间音效 / 单声道合并） ----------
  function ensureGraph() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return Promise.reject(new Error('Web Audio 不可用'));
    if (audioCtx) {
      if (audioCtx.state === 'suspended') return audioCtx.resume();
      return Promise.resolve();
    }
    // 首次创建：先激活 AudioContext，再接管 audio 输出（音频会自动重定向到 Web Audio）
    audioCtx = new Ctx();
    return audioCtx.resume().then(function () {
      mediaSource = audioCtx.createMediaElementSource(audio);
      panner = audioCtx.createStereoPanner();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      analyserData = new Uint8Array(analyser.frequencyBinCount);
      monoNodes = {
        splitter: audioCtx.createChannelSplitter(2),
        gain: audioCtx.createGain(),
        merger: audioCtx.createChannelMerger(1)
      };
      monoNodes.gain.gain.value = 0.5;
      monoNodes.splitter.connect(monoNodes.gain, 0);
      monoNodes.splitter.connect(monoNodes.gain, 1);
      monoNodes.gain.connect(monoNodes.merger);
      rebuildGraph();
    });
  }

  function rebuildGraph() {
    if (!mediaSource || !panner || !analyser) return;
    mediaSource.disconnect();
    panner.disconnect();
    analyser.disconnect();
    monoNodes.merger.disconnect();
    if (monoOn) {
      mediaSource.connect(monoNodes.splitter);
      monoNodes.merger.connect(analyser);
    } else {
      mediaSource.connect(analyser);
    }
    analyser.connect(panner);
    panner.connect(audioCtx.destination);
  }

  function startPanLfo() {
    stopPanLfo();
    if (!panner) return;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var t = (ts - start) / 1000;
      // 周期 6 秒，幅度 0.6（中高烈度，从左声道缓慢过渡到右声道）
      panner.pan.value = 0.6 * Math.sin((2 * Math.PI * t) / 6);
      panLfoId = requestAnimationFrame(step);
    }
    panLfoId = requestAnimationFrame(step);
  }

  function stopPanLfo() {
    if (panLfoId !== null) {
      cancelAnimationFrame(panLfoId);
      panLfoId = null;
    }
    if (panner) panner.pan.value = 0;
  }

  function setSpatial(on) {
    spatialOn = on;
    if (on) {
      ensureGraph().then(function () {
        startPanLfo();
      }).catch(function () {
        spatialOn = false;
        spatialToggle.checked = false;
      });
    } else {
      stopPanLfo();
    }
  }

  function setMono(mono) {
    if (monoOn === mono) return;
    monoOn = mono;
    if (mono) {
      ensureGraph().then(function () {
        rebuildGraph();
      });
    } else if (audioCtx) {
      rebuildGraph();
    }
  }

  // ---------- 音频可视化（圆形：在线真实频谱 / 本地装饰动画，64 根圆周竖条） ----------
  var VISUALIZER_INNER_RADIUS = 24;   // 柱底到圆心的距离（内半径）
  var BAR_IDLE_SCALE = 0.125;         // 柱的初始（静止）长度（scaleY）
  var BAR_FALLBACK_MS = 600;          // 暂停时柱回落到初始长度的动画时长

  function setBarTransform(bar, i, count, scale) {
    var angle = (i / count) * 360;
    bar.style.transform = 'rotate(' + angle + 'deg) translateY(-' + VISUALIZER_INNER_RADIUS + 'px) scaleY(' + scale.toFixed(3) + ')';
  }

  // 清除柱上的过渡样式与回落计时器（用于恢复播放时的即时响应）
  function clearBarTransitions() {
    if (barFallbackTimer !== null) {
      clearTimeout(barFallbackTimer);
      barFallbackTimer = null;
    }
    var bars = visualizer.children;
    for (var i = 0; i < bars.length; i++) {
      bars[i].style.transition = '';
    }
  }

  // 仅取消动画循环，不做回落（播放/切换源时先复位再重新启动）
  function cancelSpectrum() {
    if (spectrumRafId !== null) {
      cancelAnimationFrame(spectrumRafId);
      spectrumRafId = null;
    }
    clearBarTransitions();
  }

  function startSpectrum() {
    cancelSpectrum();
    if (!analyser || !analyserData || !visualizer.classList.contains('real')) return;
    var bars = visualizer.children;
    var count = bars.length;
    // 线性映射到有效频段（0 ~ 15kHz），跳过 15kHz 以上几乎无能量的死区，
    // 让左上方的高频柱也能分到有能量的频段；不再额外放大高频。
    var nyquist = audioCtx.sampleRate / 2;
    var maxFreq = Math.min(15000, nyquist * 0.95);
    var maxBin = Math.max(1, Math.floor(maxFreq / nyquist * analyserData.length));
    function step() {
      analyser.getByteFrequencyData(analyserData);
      for (var i = 0; i < count; i++) {
        var binStart = Math.floor(i * maxBin / count);
        var binEnd = Math.floor((i + 1) * maxBin / count);
        if (binEnd <= binStart) binEnd = binStart + 1;
        var sum = 0;
        for (var j = binStart; j < binEnd; j++) sum += analyserData[j];
        var avg = sum / (binEnd - binStart);
        // 正上方及向右 3 根柱对应最低频段，能量常顶满，加一点负增益
        var gain = (i < 4) ? 0.85 : 1;
        var scale = 0.15 + (avg / 255) * 0.68 * gain;
        setBarTransform(bars[i], i, count, scale);
      }
      spectrumRafId = requestAnimationFrame(step);
    }
    spectrumRafId = requestAnimationFrame(step);
  }

  function startDecorative() {
    cancelSpectrum();
    var bars = visualizer.children;
    var count = bars.length;
    var startTs = null;
    function step(ts) {
      if (startTs === null) startTs = ts;
      var t = (ts - startTs) / 1000;
      for (var i = 0; i < count; i++) {
        var scale = 0.2 + 0.64 * Math.abs(Math.sin(t * 2.2 + i * 0.4));
        setBarTransform(bars[i], i, count, scale);
      }
      spectrumRafId = requestAnimationFrame(step);
    }
    spectrumRafId = requestAnimationFrame(step);
  }

  function stopSpectrum() {
    cancelSpectrum();
    // 暂停/停止时：柱从当前高度平滑回落到初始长度，配合 .playing 移除实现变灰
    var bars = visualizer.children;
    for (var i = 0; i < bars.length; i++) {
      bars[i].style.transition = 'transform ' + BAR_FALLBACK_MS + 'ms ease, opacity 0.2s ease';
      setBarTransform(bars[i], i, bars.length, BAR_IDLE_SCALE);
    }
    barFallbackTimer = setTimeout(function () {
      clearBarTransitions();
    }, BAR_FALLBACK_MS + 50);
  }

  function setVisualizerMode(real) {
    if (real) {
      visualizer.classList.add('real');
    } else {
      visualizer.classList.remove('real');
      stopSpectrum();
    }
  }

  // ---------- 音质选择 ----------
  function fetchAudioInfo(url, signal) {
    var opts = signal ? { signal: signal } : undefined;
    return fetch('/api/music/info?url=' + encodeURIComponent(url), opts)
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error.message);
        return data;
      });
  }

  // ---------- 声道标签（多声道 / 双声道 / 单声道不打标签） ----------
  var channelCache = {};
  var channelQueue = [];
  var channelActive = 0;

  function applyChannelTag(tag, channels) {
    if (channels > 2) {
      tag.textContent = '多声道';
      tag.hidden = false;
    } else if (channels === 2) {
      tag.textContent = '双声道';
      tag.hidden = false;
    } else {
      tag.hidden = true;
    }
  }

  function channelInfo(job) {
    // 在线歌曲 + 选了播放源：一次请求完成「解析地址 + 声道探测」；失败回退 Meting 地址
    if (job.isOnline && resolveSourceEl.value) {
      var lxSource = SEARCH_TO_LX[sourceEl.value] || '';
      var songId = extractSongId(job.song.url);
      if (lxSource && songId) {
        var url = '/api/music/resolve-info?provider=' + encodeURIComponent(resolveSourceEl.value) +
          '&source=' + encodeURIComponent(lxSource) +
          '&songId=' + encodeURIComponent(songId);
        return fetch(url)
          .then(function (resp) { return resp.json(); })
          .then(function (data) {
            if (typeof data.channels === 'number') return data.channels;
            throw new Error('resolve failed');
          })
          .catch(function () {
            return fetchAudioInfo(job.song.url).then(function (info) { return info.channels || 1; });
          });
      }
    }
    var audioUrl = job.isOnline ? job.song.url : job.song.src;
    return fetchAudioInfo(audioUrl).then(function (info) { return info.channels || 1; });
  }

  function pumpChannelQueue() {
    while (channelActive < 4 && channelQueue.length) {
      var job = channelQueue.shift();
      channelActive++;
      channelInfo(job).then(function (ch) {
        channelCache[job.cacheKey] = ch;
        applyChannelTag(job.tag, ch);
      }).catch(function () {
        channelCache[job.cacheKey] = 1;
      }).then(function () {
        channelActive--;
        pumpChannelQueue();
      });
    }
  }

  // 清空尚未开始的探测任务（切歌/重搜/换源时调用），已发出的请求结果仍会写缓存，无害
  function clearChannelQueue() {
    channelQueue.length = 0;
  }

  function labelChannel(tag, song, isOnline) {
    var baseUrl = isOnline ? song.url : song.src;
    if (!baseUrl) return;
    var cacheKey = (isOnline ? (resolveSourceEl.value || 'default') : 'local') + '|' + baseUrl;
    if (channelCache[cacheKey] !== undefined) {
      applyChannelTag(tag, channelCache[cacheKey]);
      return;
    }
    channelQueue.push({ tag: tag, song: song, isOnline: isOnline, cacheKey: cacheKey });
    pumpChannelQueue();
  }

  function infoKey(info) {
    return info.format + '|' + info.sample_rate + '|' + info.bitrate + '|' + info.channels;
  }

  function refreshAudioInfo() {
    if (!nowPlaying.type) {
      currentQualityKey = '';
      setMultichannelAvailable(false);
      return;
    }
    // 取消上一次未完成的探测，避免快速切歌时旧请求堆积
    if (infoAbort) infoAbort.abort();
    infoAbort = new AbortController();
    // 一次请求同时更新「当前音质框选」和「多声道开关」状态，避免并发请求互相竞争
    fetchAudioInfo(nowPlaying.baseUrl, infoAbort.signal).then(function (info) {
      currentQualityKey = infoKey(info);
      setMultichannelAvailable(info.channels >= 2);
    }).catch(function () {
      currentQualityKey = '';
      setMultichannelAvailable(false);
    });
  }

  function qualityLabel(info) {
    if (info.format === 'flac') return '无损';
    var br = info.bitrate;
    if (br >= 900) return '无损';
    if (br >= 300) return '高品';
    if (br >= 190) return '较高';
    return '标准';
  }

  function formatQuality(info) {
    var khz = (info.sample_rate / 1000).toFixed(1);
    if (info.format === 'flac') {
      return '无损 · ' + khz + 'kHz';
    }
    if (info.bitrate) {
      return qualityLabel(info) + ' · ' + khz + 'kHz/' + info.bitrate + 'kbps';
    }
    // m4a 等无码率信息的格式：不显示「无损」，只显示档位 + 采样率
    return qualityLabel(info) + ' · ' + khz + 'kHz';
  }

  function emptyQualityHint(text) {
    var div = document.createElement('div');
    div.className = 'quality-empty';
    div.textContent = text;
    qualityList.appendChild(div);
  }

  function probeQualities() {
    var levels = QUALITY_LEVELS[nowPlaying.server] || QUALITY_LEVELS.netease;
    var jobs = levels.map(function (br) {
      var url = nowPlaying.baseUrl + '&br=' + br;
      return fetchAudioInfo(url).then(function (info) {
        return { url: url, info: info };
      }).catch(function () { return null; });
    });
    return Promise.all(jobs).then(function (results) {
      var seen = {};
      var out = [];
      results.forEach(function (r) {
        if (!r) return;
        var key = r.info.format + '|' + r.info.sample_rate + '|' + r.info.bitrate + '|' + r.info.channels;
        if (seen[key]) return;
        seen[key] = true;
        out.push(r);
      });
      return out;
    });
  }

  function probeLocalQuality() {
    return fetchAudioInfo(nowPlaying.baseUrl).then(function (info) {
      return [{ url: nowPlaying.baseUrl, info: info }];
    }).catch(function () { return []; });
  }

  function renderQualityList() {
    qualityList.innerHTML = '';
    if (!nowPlaying.type) {
      emptyQualityHint('请先播放一首歌曲');
      return;
    }
    emptyQualityHint('探测音质中…');
    var promise = (nowPlaying.type === 'online' && isMetingUrl(nowPlaying.baseUrl)) ? probeQualities() : probeLocalQuality();
    promise.then(function (list) {
      qualityList.innerHTML = '';
      if (!list.length) {
        emptyQualityHint('无法获取音质信息');
        return;
      }
      list.forEach(function (item) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quality-item';
        btn.textContent = formatQuality(item.info);
        if (infoKey(item.info) === currentQualityKey) btn.classList.add('active');
        btn.addEventListener('click', function () { switchQuality(item); });
        qualityList.appendChild(btn);
      });
    });
  }

  function switchQuality(item) {
    if (!item || !item.url || item.url === audio.src) return;
    var wasPlaying = !audio.paused;
    var pos = audio.currentTime || 0;
    audio.addEventListener('loadedmetadata', function resume() {
      audio.removeEventListener('loadedmetadata', resume);
      if (wasPlaying) safePlay();
      try { audio.currentTime = pos; } catch (e) {}
    });
    audio.src = item.url;
    currentQualityKey = infoKey(item.info);
    setMultichannelAvailable(item.info.channels >= 2);
  }

  // ---------- 多声道 ----------
  function setMultichannelAvailable(avail) {
    var label = multichannelToggle.closest('.more-toggle');
    multichannelToggle.disabled = !avail;
    if (label) label.classList.toggle('disabled', !avail);
    if (avail) {
      // 双声道及以上：开=双声道，关=合并单声道
      setMono(!multichannelToggle.checked);
    } else {
      // 单声道源：无需合并，恢复直通
      setMono(false);
    }
  }

  // ---------- 更多菜单 ----------
  function setMoreMenu(open) {
    moreMenu.hidden = !open;
    moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) renderQualityList();
  }

  function isSearchMode() {
    return searchEl.value.trim().length > 0;
  }

  function renderPlaylist() {
    if (isSearchMode()) {
      renderOnlineResults();
    } else {
      renderUserSongs();
    }
  }

  function makeItem() {
    var li = document.createElement('li');
    var main = document.createElement('div');
    main.className = 'pl-main';
    li.appendChild(main);

    var title = document.createElement('div');
    title.className = 'pl-title';
    var titleText = document.createElement('span');
    titleText.className = 'pl-title-text';
    var channelTag = document.createElement('span');
    channelTag.className = 'channel-tag';
    channelTag.hidden = true;
    title.appendChild(titleText);
    title.appendChild(channelTag);

    var artist = document.createElement('div');
    artist.className = 'pl-artist';
    main.appendChild(title);
    main.appendChild(artist);

    li.appendChild(main);
    return { li: li, titleText: titleText, artist: artist, channelTag: channelTag };
  }

  function makeDownloadLink(src, name) {
    var a = document.createElement('a');
    a.className = 'download-song';
    a.href = '/api/music/download?url=' + encodeURIComponent(src) + '&name=' + encodeURIComponent(name);
    a.setAttribute('download', '');
    a.innerHTML = DOWNLOAD_SVG;
    a.title = '下载';
    a.setAttribute('aria-label', '下载 ' + name);
    a.addEventListener('click', function (e) { e.stopPropagation(); });
    return a;
  }

  function emptyHint(text) {
    var li = document.createElement('li');
    li.className = 'playlist-empty';
    li.textContent = text;
    playlistEl.appendChild(li);
  }

  function renderUserSongs() {
    playlistEl.innerHTML = '';
    userSongs.forEach(function (song, index) {
      var item = makeItem();
      item.li.className = 'playlist-item' + (index === currentIndex ? ' active' : '');
      item.li.setAttribute('data-index', index);
      item.titleText.textContent = song.title;
      item.artist.textContent = song.artist || '未知歌手';
      labelChannel(item.channelTag, song, false);

      item.li.appendChild(makeDownloadLink(song.src, song.title + ' - ' + (song.artist || '未知歌手')));

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'remove-song';
      rm.setAttribute('aria-label', '删除 ' + song.title);
      rm.textContent = '×';
      rm.addEventListener('click', function (e) {
        e.stopPropagation();
        removeUserSong(index);
      });
      item.li.appendChild(rm);

      item.li.addEventListener('click', function () {
        playUser(parseInt(item.li.getAttribute('data-index'), 10));
      });
      playlistEl.appendChild(item.li);
    });

    if (!playlistEl.children.length) {
      emptyHint('暂无歌曲，点击下方「添加歌曲」添加，或在搜索框搜索在线歌曲');
    }
  }

  function renderOnlineResults() {
    playlistEl.innerHTML = '';

    if (searching) {
      emptyHint('搜索中…');
      return;
    }
    if (!onlineResults.length) {
      emptyHint('未找到在线歌曲');
      return;
    }

    onlineResults.forEach(function (song, index) {
      var item = makeItem();
      item.li.className = 'playlist-item' + (index === currentOnline ? ' active' : '');
      item.li.setAttribute('data-index', index);
      item.titleText.textContent = song.title;
      item.artist.textContent = song.author || '未知歌手';
      labelChannel(item.channelTag, song, true);

      item.li.appendChild(makeDownloadLink(song.url, song.title + ' - ' + (song.author || '未知歌手')));

      item.li.addEventListener('click', function () {
        playOnline(parseInt(item.li.getAttribute('data-index'), 10));
      });
      playlistEl.appendChild(item.li);
    });
  }

  function removeUserSong(index) {
    if (index < 0 || index >= userSongs.length) return;
    userSongs.splice(index, 1);
    saveUserSongs();

    if (currentIndex === index) {
      stopPlayback();
    } else if (currentIndex > index) {
      currentIndex--;
    }

    renderPlaylist();
  }

  function stopPlayback() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    currentIndex = -1;
    currentOnline = -1;
    nowPlaying = { type: null, baseUrl: '', server: '', title: '', artist: '' };
    setMultichannelAvailable(false);
    npTitle.textContent = '未在播放';
    npArtist.textContent = '从下方列表选择或搜索歌曲';
    seekBar.value = '0';
    curTimeEl.textContent = '0:00';
    durTimeEl.textContent = '0:00';
    playBtn.innerHTML = PLAY_SVG;
    playBtn.setAttribute('aria-label', '播放');
    setVisualizerMode(false);
    updateMediaSession();
  }

  function playUser(index) {
    if (index < 0 || index >= userSongs.length) return;

    if (index === currentIndex) {
      if (audio.paused) safePlay();
      return;
    }

    playToken++;
    if (resolveAbort) resolveAbort.abort();
    clearChannelQueue();
    currentIndex = index;
    currentOnline = -1;
    var song = userSongs[index];
    nowPlaying = { type: 'local', baseUrl: song.src, server: '', title: song.title, artist: song.artist || '未知歌手' };
    setVisualizerMode(false);
    audio.src = song.src;
    safePlay();
    npTitle.textContent = song.title;
    npArtist.textContent = song.artist || '未知歌手';
    refreshAudioInfo();
    renderPlaylist();
    updateMediaSession();
  }

  // 播放源解析：默认走 Meting 直链，可选走公益/聚合源（后端代理跨域）
  var SEARCH_TO_LX = { netease: 'wy', tencent: 'tx', kugou: 'kg' };

  function extractSongId(url) {
    var m = url && url.match(/[?&]id=([^&]+)/);
    return m ? m[1] : '';
  }

  function isMetingUrl(url) {
    return !!(url && url.indexOf('meting') !== -1);
  }

  function resolvePlayUrl(song, signal) {
    var provider = resolveSourceEl.value;
    var lxSource = SEARCH_TO_LX[sourceEl.value] || '';
    var songId = extractSongId(song.url);
    if (!provider || !lxSource || !songId) return Promise.resolve(song.url);
    var url = '/api/music/resolve?provider=' + encodeURIComponent(provider) +
      '&source=' + encodeURIComponent(lxSource) +
      '&songId=' + encodeURIComponent(songId);
    return fetch(url, signal ? { signal: signal } : undefined)
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        if (data.url) return data.url;
        throw new Error(data.error && data.error.message || '解析失败');
      })
      .catch(function () {
        return song.url;
      });
  }

  function playOnline(index) {
    if (index < 0 || index >= onlineResults.length) return;
    var song = onlineResults[index];
    if (resolveAbort) resolveAbort.abort();
    resolveAbort = new AbortController();
    var token = ++playToken;
    clearChannelQueue();
    currentIndex = -1;
    currentOnline = index;
    setVisualizerMode(true);

    resolvePlayUrl(song, resolveAbort.signal).then(function (url) {
      if (token !== playToken) return;  // 已被更新的切歌接管，丢弃过期结果
      nowPlaying = { type: 'online', baseUrl: url, server: sourceEl.value, title: song.title, artist: song.author || '未知歌手' };
      audio.src = url;
      safePlay();
      npTitle.textContent = song.title;
      npArtist.textContent = song.author || '未知歌手';
      refreshAudioInfo();
      renderPlaylist();
      updateMediaSession();
    });
  }

  function togglePlay() {
    if (currentIndex < 0 && currentOnline < 0) {
      if (userSongs.length) playUser(0);
      return;
    }
    if (audio.paused) {
      safePlay();
    } else {
      audio.pause();
    }
  }

  function next() {
    if (isSearchMode()) {
      if (onlineResults.length <= 1) return;
      var i = currentOnline < 0 ? 0 : (currentOnline + 1) % onlineResults.length;
      playOnline(i);
    } else {
      if (userSongs.length <= 1) return;
      var i = currentIndex < 0 ? 0 : (currentIndex + 1) % userSongs.length;
      playUser(i);
    }
  }

  function prev() {
    if (isSearchMode()) {
      if (onlineResults.length <= 1) return;
      var i = currentOnline < 0 ? onlineResults.length - 1 : (currentOnline - 1 + onlineResults.length) % onlineResults.length;
      playOnline(i);
    } else {
      if (userSongs.length <= 1) return;
      var i = currentIndex < 0 ? userSongs.length - 1 : (currentIndex - 1 + userSongs.length) % userSongs.length;
      playUser(i);
    }
  }

  function doSearch(kw) {
    if (searchAbort) searchAbort.abort();
    searchAbort = new AbortController();
    clearChannelQueue();
    searching = true;
    renderPlaylist();

    fetch(METING_API + '?server=' + sourceEl.value + '&type=search&id=' + encodeURIComponent(kw), { signal: searchAbort.signal })
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        onlineResults = Array.isArray(data) ? data : [];
        searching = false;
        renderPlaylist();
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;  // 已由更新的搜索接管，忽略
        onlineResults = [];
        searching = false;
        renderPlaylist();
      });
  }

  searchEl.addEventListener('input', function () {
    var kw = searchEl.value.trim();
    if (searchTimer) clearTimeout(searchTimer);

    if (!kw) {
      if (searchAbort) searchAbort.abort();
      clearChannelQueue();
      onlineResults = [];
      searching = false;
      renderPlaylist();
      return;
    }

    searchTimer = setTimeout(function () { doSearch(kw); }, 400);
  });

  sourceEl.addEventListener('change', function () {
    var kw = searchEl.value.trim();
    if (kw) doSearch(kw);
  });

  resolveSourceEl.addEventListener('change', function () {
    // 播放源只影响播放地址解析，不影响搜索；切换时清空声道缓存并重绘列表，让标签重新探测
    channelCache = {};
    clearChannelQueue();
    renderPlaylist();
  });

  playBtn.addEventListener('click', togglePlay);
  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);

  moreBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    setMoreMenu(moreMenu.hidden);
  });

  document.addEventListener('click', function (e) {
    if (moreMenu.hidden) return;
    if (moreMenu.contains(e.target) || moreBtn.contains(e.target)) return;
    setMoreMenu(false);
  });

  spatialToggle.addEventListener('change', function () {
    setSpatial(spatialToggle.checked);
  });

  multichannelToggle.addEventListener('change', function () {
    setMono(!multichannelToggle.checked);
  });

  loopToggle.addEventListener('change', function () {
    loopOn = loopToggle.checked;
  });

  seekBar.addEventListener('input', function () {
    if (!isFinite(audio.duration)) return;
    audio.currentTime = (seekBar.value / 100) * audio.duration;
  });

  addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var title = titleEl.value.trim();
    var artist = artistEl.value.trim();
    var url = urlEl.value.trim();
    if (!title || !url) return;

    userSongs.unshift({ title: title, artist: artist, src: url });
    saveUserSongs();
    titleEl.value = '';
    artistEl.value = '';
    urlEl.value = '';
    searchEl.value = '';
    onlineResults = [];
    currentIndex = -1;
    renderPlaylist();
    playUser(0);
  });

  audio.addEventListener('timeupdate', function () {
    if (isFinite(audio.duration) && audio.duration > 0) {
      seekBar.value = String((audio.currentTime / audio.duration) * 100);
    }
    curTimeEl.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('loadedmetadata', function () {
    durTimeEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('error', function () {
    if (nowPlaying.type) {
      npArtist.textContent = '加载失败：该音源不可用，请尝试其他音源';
    }
  });

  audio.addEventListener('play', function () {
    playBtn.innerHTML = PAUSE_SVG;
    playBtn.setAttribute('aria-label', '暂停');
    visualizer.classList.add('playing');
    updateMediaSession();
    if (visualizer.classList.contains('real')) {
      ensureGraph().then(startSpectrum).catch(function () {
        visualizer.classList.remove('real');
      });
    } else {
      startDecorative();
    }
  });

  audio.addEventListener('pause', function () {
    playBtn.innerHTML = PLAY_SVG;
    playBtn.setAttribute('aria-label', '播放');
    visualizer.classList.remove('playing');
    stopSpectrum();
    updateMediaSession();
  });

  audio.addEventListener('ended', function () {
    if (loopOn) {
      // 单曲循环：从头重新播放当前歌曲
      audio.currentTime = 0;
      safePlay();
    } else {
      next();
    }
  });

  // ---------- 后台播放支持（移动端切后台 / 锁屏继续播放） ----------
  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      if (nowPlaying.type) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: nowPlaying.title,
          artist: nowPlaying.artist,
          album: '泠风吹梦的小站'
        });
      } else {
        navigator.mediaSession.metadata = null;
      }
      navigator.mediaSession.playbackState = nowPlaying.type
        ? (audio.paused ? 'paused' : 'playing')
        : 'none';
    } catch (e) {
      // MediaMetadata / playbackState 不支持时忽略
    }
  }

  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('play', function () { togglePlay(); });
      navigator.mediaSession.setActionHandler('pause', function () { audio.pause(); });
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', next);
    } catch (e) {
      // 部分浏览器不支持 setActionHandler，忽略
    }
  }

  document.addEventListener('visibilitychange', function () {
    // 从后台切回时恢复被浏览器挂起的 AudioContext（空间音效/多声道场景）
    if (!document.hidden && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  });

  setupMediaSession();
  stopSpectrum();  // 初始化可视化柱到静止态（正确角度）
  renderPlaylist();
})();
