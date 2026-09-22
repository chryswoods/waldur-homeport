import * as echarts from 'echarts/lib/echarts';

import 'echarts/lib/component/legend';
import 'echarts/lib/component/tooltip';
import 'echarts/lib/component/toolbox';
// Required by the OpenPortal report charts: the allocation and usage charts
// use a dataZoom slider, and the storage report renders a treemap. Without
// these registrations ECharts silently drops both.
import 'echarts/lib/component/dataZoom';
import 'echarts/lib/chart/bar';
import 'echarts/lib/chart/line';
import 'echarts/lib/chart/pie';
import 'echarts/lib/chart/treemap';
import './themes';

export default echarts;
