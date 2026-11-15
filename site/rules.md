项目简介：开发本地小站（后期会利用内网穿透/现有域名将其对互联网开放）

注意事项：
1. 项目结构清晰简洁，避免屎山代码
2. 项目模块化并联设计，一块坏了不会影响到整体
3. 项目所有文件命名应符合规范，禁止特殊字符、禁止中文
4. 创新性思路，极简风格设计，避免花里胡哨的 AI 审美
5. 完成任务后认真核查代码，不自我满足，每轮对话结束后以批判性眼光查验项目
6. 每轮对话后将对话重点/用户重要需求/用户要求强化记忆的项记录在本文件的 importance 栏
7. 认真对待本文件，每轮对话结束后查验 importance 栏并整理

结构：
	index.html			主界面（顶部 3 项导航 + 底部灰色小字 "power by trae"）
	package.json		本地预览：npm start（http-server，8000 端口）
	css/style.css		全站极简样式（统一变量，含日/夜间主题、卡片、音乐播放器）
	js/main.js			移动端检测 + 导航高亮 + 日/夜间模式切换（右下角按钮，交叉淡入淡出）
	js/music.js			音乐播放器逻辑（在线搜索多音源 + 播放控制 + 手动添加音源 + 每首歌下载按钮 + 更多菜单/音质/空间音效/多声道/单曲循环 + 音频可视化 + 声道标签 + 播放源解析 + 站内软导航/迷你卡片/特殊页面 iframe 承载）
	server/proxy.py		本地代理服务器（静态文件服务 + 音乐接口 + 禁止访问 server 目录）
	server/music_api.py	音乐接口混入类（download/info/resolve/resolve-info，供 proxy.py 使用）


	games/starring/		星环·天穹 星际即时策略游戏（BETA，music/ 下为背景音乐）
	3d-learner/			3D 几何模拟（预设几何体 + 自定义多边形 + 组合体 + 三视图，本地 three.js）
	yinyuan/			收集的音源参考脚本（不参与站点加载）
	pages/tools.html		开发的小玩意（含星环 BETA、音乐播放器、文件查找工具、非常神秘的项目、3D几何模拟卡片）
	pages/music.html		音乐播放器（搜索 + 音源选择 + 正在播放 + 手动添加音源 + 更多菜单）
	pages/shenmi.html		非常神秘的项目（ysnb）
	pages/about.html		小站介绍（已完善内容）

importance：
	【站点基础】
	- 站名：泠风吹梦的小站
	- 导航 3 项：首页 / 开发的小玩意 / 小站介绍
	- 首页底部灰色小字 "power by trae"
	- 文件与文件夹命名禁止中文（主文件夹 lingsite）
	- 日/夜间模式：右下角按钮切换，localStorage 持久化，缺省跟随系统，交叉淡入淡出

	【功能模块】
	- 3 项入口全部落实
	- 开发的小玩意：星环 BETA（games/starring）、音乐播放器、文件查找工具（百度网盘分享）、非常神秘的项目（pages/shenmi.html）、3D几何模拟（3d-learner/）
	- 网速测试功能已删除，不再保留页面、脚本与测速文件
	- 可执行文件（.exe）不放在站内，统一走网盘分享

	【音乐播放器】
	- 结构：pages/music.html + js/music.js
	- 在线搜索（网易云/QQ音乐/酷狗，三音源均可用）+ 播放控制 + 手动添加音源（localStorage 持久化）
	- 在线音源 API：网易云 GD Studio（备用 Meting 镜像）、QQ音乐 后端收集聚合/落月 API、酷狗 官方搜索/播放接口（JSONP）；搜索不依赖后端，QQ音乐后端可用时走完整音质
	- 每首歌下载：后端 /api/music/download 代理（规避跨域并统一文件名）
	- 更多菜单：音质选择 / 空间音效 / 多声道 / 单曲循环开关
	- 音质选择：后端 /api/music/info 解析采样率/比特率/声道，按 br 档位探测去重，显示 "XX.XkHz/XXXkbps"
	- 空间音效：StereoPanner 左右摆动（6s 周期，幅度 0.6 中高烈度）
	- 多声道开关：声道 >=2 亮起；开=双声道及更高，关=合并单声道
	- 播放高亮：正在播放歌曲边框框选 + 慢速低幅度闪烁（3s 周期）
	- 后台播放：Media Session API（锁屏/通知栏控制与歌曲信息）+ audio 增加 playsinline + 切回前台恢复被挂起的 AudioContext
	- 音频可视化：页面右侧面板，在线真实频谱（AnalyserNode）/ 本地装饰动画
	- 声道标签：播放列表按声道数打标签（多声道>2 / 双声道=2 / 单声道不标）
	- 播放源框架：后端 /api/music/resolve 代理公益/聚合源，前端「播放源」下拉；多数第三方接口失效，仅收集聚合-QQ 可用，待恢复

	【关键技术决策】
	- Web Audio：audio 须 crossOrigin='anonymous'（否则跨域音频被 createMediaElementSource 输出静音）；默认原生播放，仅开启空间音效/多声道时创建 Web Audio 图（先 resume 再接管）

	【星环游戏】
	- 目录 games/starring，背景音乐放 music/（normal.mp3 菜单 / fight.mp3 战斗）
	- 音频在首次用户手势后解锁：监听 pointerdown/touchstart/keydown/click（按钮 stopPropagation 会拦掉 document click）
	- MusicManager 使用 preload=none：菜单音乐开始播放时才下载，战斗音乐进入战斗才加载

	【本地预览】
	- npm start（http-server）在 8000 端口开放 site 目录，绑定 0.0.0.0，便于内网/穿透访问
	- /api/music/* 仅由 server/proxy.py 提供；只用 npm start 时，下载/音质/声道探测/播放源解析不可用（搜索与网易云/酷狗播放不受影响，QQ音乐自动回退落月 API，部分歌曲可能为试听或不可用）
	- proxy.py 安全约束：仅开放 /site 与 /api（根路径 302 到 /site/）；server、yinyuan、rules.md、project-status.md 禁止访问，路径需解码/规范化/大小写归一后校验；音乐代理只允许公网地址（拒绝回环/内网/保留地址，防 SSRF）
