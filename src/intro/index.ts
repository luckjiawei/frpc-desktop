import introJs from "intro.js";
import "intro.js/introjs.css";

const intro = introJs.tour();
// 更多配置参数请到官方文档查看
intro.setOptions({
  autoPosition: false,
  tooltipPosition: "right",
  exitOnOverlayClick: false
  // hidePrev: true,       // 在第一步中是否隐藏上一个按钮
  // hideNext: true,       // 在最后一步中是否隐藏下一个按钮
  // exitOnOverlayClick: false,  // 点击叠加层时是否退出介绍
  // showStepNumbers: false,     // 是否显示红色圆圈的步骤编号
  // showBullets: false          // 是否显示面板指示点
});

export default intro;
