简介：
背景地图视野需锁定在中国极其周边区域，同时可进行缩放查看详细信息。港口区域需要特别标注，鼠标移动至港口可显示港口详细信息。每个港口之间会加载航线详细信息，鼠标移动至航线会显示航线具体业务数据等。同时地图上会加载实时渲染风场、洋流、波浪的气象数据的流体动力学动画。

核心技术栈：
	前端框架：JavaScript
地图引擎核心：使用OpenLayers加载平面地图。
	流体动画引擎：使用wind-layer（github网站: https://github.com/sakitam-fdd/wind-layer）插件，通过流体场的方式去对风场、洋流场和波浪场的气象数据进行可视化。
	
核心功能模块：
	1，地图视窗 (Main Map Viewport)
视野锁定： 默认加载并锁定在中国及周边海域边界（Bounding Box），限制最小缩放级别，禁止用户拖拽至全球视图。
分层渲染架构：
底层 (Base)： 深色系矢量底图（如 CartoDB Dark）。陆地和海洋使用不同的颜色，陆地使用灰色系海洋使用蓝色系。两种颜色的饱和度和透明度都要较低。
中间层 (Environment)： 动态流体粒子动画层（风、洋流、波浪）。
顶层 (Business)： 海事节点层（中国主要港口、航线，需支持高频数据刷新和用户鼠标交互）。
	2，环境数据控制台 (Side Console)
控制台窗口位于窗口左下角。支持单选切换【风 (Wind)】、【洋流 (Currents)】、【波浪 (Waves)】三种不同的模式。不同模式需调用不同的矢量场数据和粒子运动模式。因此控制台参数的切换会直接驱动流体动画引擎重绘。
3，时间轴
界面底部提供类似视频播放器的进度条的数据时间轴。每个时间轴间隔3h，时间轴点意味着加载新的矢量场气候数据。拥有按钮选择是否继续或暂停时间。在切换时间帧时，仅替换中间层流体矢量场 (U/V 矩阵)，实现流线顺滑扭转的视觉效果。

交互要求：
1，	用户打开应用时默认加载并锁定在中国及周边海域边界（Bounding Box），可通过滚轮对地图进行缩放，或拖曳地图来显示更详细的信息，但禁止用户缩放拖曳至全球视图。
2，	用户点击地图的具体位置时，地图会出现小点并显示当前地点经纬度和洋流信息。
3，	用户将鼠标移动到港口时，会出现小窗口显示港口具体信息如名称、经纬度等。用户将鼠标移动到航线时会有小窗口显示航线具体信息如航线名称等。窗口大小和内容可拓展方便日后维护或增加新内容。
4，	用户与环境数据控制台交互时，可选择风速、洋流、波浪三种观测类型，选择每种类型会加载该类型的气候数据，使用流体动画引擎wind-layer渲染后呈现。

数据需求：
	详细了解wind-layer插件的需求后，按照插件要求调用免费api获取数据。插件github网址：https://github.com/sakitam-fdd/wind-layer

如何获取天气数据：
天气数据由全球预报系统（GFS）生成， 由美国国家气象局管理。 预测每天产生四次，并可用于 从NOMADS下载。 这些文件位于GRIB2 格式并包含超过300条记录。 我们只需要这些记录中的一小部分就可以在特定的等压线上可视化风资料。 下面的命令下载 1000 hPa风向量，并使用grib2json将它们转换为JSON格式。
YYYYMMDD=<a date, for example: 20140101>
curl "http://nomads.ncep.noaa.gov/cgi-bin/filter_gfs.pl?file=gfs.t00z.pgrb2.1p00.f000&lev_10_m_above_ground=on&var_UGRD=on&var_VGRD=on&dir=%2Fgfs.${YYYYMMDD}00" -o gfs.t00z.pgrb2.1p00.f000
grib2json -d -n -o current-wind-surface-level-gfs-1.0.json gfs.t00z.pgrb2.1p00.f000
cp current-wind-surface-level-gfs-1.0.json <earth-git-repository>/public/data/weather/current
