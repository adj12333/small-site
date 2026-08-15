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
	index.html			主界面（顶部 5 项导航 + 底部灰色小字 "power by trae"）
	css/style.css		全站极简样式（统一变量，含日/夜间主题、卡片、音乐播放器、网速测试、聊天）
	js/main.js			导航高亮 + 日/夜间模式切换（右下角按钮，交叉淡入淡出）
	js/music.js			音乐播放器逻辑（在线搜索多音源 + 播放控制 + 手动添加音源 + 每首歌下载按钮 + 更多菜单/音质/空间音效/多声道/单曲循环 + 音频可视化 + 声道标签 + 播放源解析）
	js/speedtest.js		网速测试逻辑（延迟 + 下载速度）
	js/chat.js			与 DeepSeek 聊天前端逻辑（调本地 /api/chat，流式输出 + 人机验证）
	server/proxy.py		本地代理服务器（静态文件服务 + /api/chat 中转 DeepSeek + /api/music/download 下载代理 + /api/music/info 音频信息解析 + /api/music/resolve 播放源解析，含人机验证与全局每日 token 配额）
	server/key.txt		DeepSeek API Key（仅服务端，禁止泄露/提交到 git）
	server/usage.json	服务端每日 token 用量持久化（重启不丢失）
	games/starring/		星环·天穹 星际即时策略游戏（BETA）
	downloads/FileSearch.exe	文件查找工具（Windows 文件查找，卡片下载）
	speedtest/100mb.bin	网速测试下载文件（100MB）
	pages/tools.html		开发的小玩意（含星环 BETA、音乐播放器、文件查找工具、非常神秘的项目卡片）
	pages/music.html		音乐播放器（搜索 + 音源选择 + 正在播放 + 手动添加音源 + 更多菜单）
	pages/shenmi.html		非常神秘的项目（ysnb）
	pages/speedtest.html	网速测试（延迟 + 下载速度）
	pages/chat.html		与 DeepSeek 聊天（多轮对话）
	pages/about.html		小站介绍（已完善内容）

importance：
	【站点基础】
	- 站名：泠风吹梦的小站
	- 导航 5 项：首页 / 开发的小玩意 / 网速测试 / 与deepseek聊天 / 小站介绍
	- 首页底部灰色小字 "power by trae"
	- 文件与文件夹命名禁止中文（主文件夹 lingsite）
	- 日/夜间模式：右下角按钮切换，localStorage 持久化，缺省跟随系统，交叉淡入淡出

	【功能模块】
	- 5 项入口全部落实
	- 开发的小玩意：星环 BETA（games/starring）、音乐播放器、文件查找工具（downloads/FileSearch.exe）、非常神秘的项目（pages/shenmi.html）
	- 网速测试：延迟 + 下载速度，依赖 speedtest/100mb.bin，需 HTTP 访问
	- DeepSeek 聊天：前端调 /api/chat 流式输出，Key 存 server/key.txt（仅服务端，禁止泄露）

	【音乐播放器】
	- 结构：pages/music.html + js/music.js
	- 在线搜索（网易云/QQ音乐/酷狗，当前仅网易云可用）+ 播放控制 + 手动添加音源（localStorage 持久化）
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

	【安全与配额】
	- 人机验证：算术题，答对发放一次性会话 token（防刷 token）
	- 每日 token 配额：2000（全局共享，每天重置，持久化 usage.json），耗尽提示"服务端token已耗尽，请明天再来吧"

	【关键技术决策】
	- Web Audio：audio 须 crossOrigin='anonymous'（否则跨域音频被 createMediaElementSource 输出静音）；默认原生播放，仅开启空间音效/多声道时创建 Web Audio 图（先 resume 再接管）
