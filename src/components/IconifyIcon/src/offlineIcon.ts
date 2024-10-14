import {addIcon} from "@iconify/vue/dist/offline";

/**
 * 这里存放本地图标，在 src/layout/index.vue 文件中加载，避免在首启动加载
 */

// 本地菜单图标，后端在路由的icon中返回对应的图标字符串并且前端在此处使用addIcon添加即可渲染菜单图标
import Cloud from "@iconify-icons/material-symbols/cloud";
import RocketLaunchRounded from "@iconify-icons/material-symbols/rocket-launch-rounded";
import Download from "@iconify-icons/material-symbols/download-2";
import Settings from "@iconify-icons/material-symbols/settings";
import FileCopySharp from "@iconify-icons/material-symbols/file-copy-sharp";
import InfoSharp from "@iconify-icons/material-symbols/info-sharp";
import refreshRounded from "@iconify-icons/material-symbols/refresh-rounded";

import MoreVert from "@iconify-icons/material-symbols/more-vert";
import Add from "@iconify-icons/material-symbols/add";
import BringYourOwnIpRounded from "@iconify-icons/material-symbols/bring-your-own-ip-rounded";
import DeleteRounded from "@iconify-icons/material-symbols/delete-rounded";
import RefreshRounded from "@iconify-icons/material-symbols/refresh-rounded";
import CancelPresentation from "@iconify-icons/material-symbols/cancel-presentation";
import GestureSelect from "@iconify-icons/material-symbols/gesture-select";
import SaveRounded from "@iconify-icons/material-symbols/save-rounded";
import Info from "@iconify-icons/material-symbols/info";
import QuestionMark from "@iconify-icons/material-symbols/question-mark";
import CheckCircleRounded from "@iconify-icons/material-symbols/check-circle-rounded";
import Error from "@iconify-icons/material-symbols/error";
import ContentCopy from "@iconify-icons/material-symbols/content-copy";
import ContentPasteGo from "@iconify-icons/material-symbols/content-paste-go";
import Edit from "@iconify-icons/material-symbols/edit";
import CheckBox from "@iconify-icons/material-symbols/check-box";
import ExportNotesOutline from "@iconify-icons/material-symbols/export-notes-outline";
import uploadRounded from "@iconify-icons/material-symbols/upload-rounded";
import downloadRounded from "@iconify-icons/material-symbols/download-rounded";
import deviceReset from "@iconify-icons/material-symbols/device-reset";
import switchAccessOutlineRounded from "@iconify-icons/material-symbols/switch-access-outline-rounded";
import switchAccessRounded from "@iconify-icons/material-symbols/switch-access-rounded";
import chargerRounded from "@iconify-icons/material-symbols/charger-rounded";

addIcon("cloud", Cloud);
addIcon("rocket-launch-rounded", RocketLaunchRounded);
addIcon("download", Download);
addIcon("settings", Settings);
addIcon("file-copy-sharp", FileCopySharp);
addIcon("info-sharp", InfoSharp);
addIcon("refresh-rounded", refreshRounded);
addIcon("more-vert", MoreVert);
addIcon("add", Add);
addIcon("bring-your-own-ip-rounded", BringYourOwnIpRounded);
addIcon("charger-rounded", chargerRounded);
addIcon("delete-rounded", DeleteRounded);
addIcon("cancel-presentation", CancelPresentation);
addIcon("gesture-select", GestureSelect);
addIcon("save-rounded", SaveRounded);
addIcon("refresh-rounded", RefreshRounded);
addIcon("info", Info);
addIcon("question-mark", QuestionMark);
addIcon("check-circle-rounded", CheckCircleRounded);
addIcon("error", Error);
addIcon("content-copy", ContentCopy);
addIcon("content-paste-go", ContentPasteGo);
addIcon("edit", Edit);
addIcon("check-box", CheckBox);
addIcon("export", ExportNotesOutline);
addIcon("uploadRounded", uploadRounded);
addIcon("downloadRounded", downloadRounded);
addIcon("deviceReset", deviceReset);
addIcon("switchAccessOutlineRounded", switchAccessOutlineRounded);
addIcon("switchAccessRounded", switchAccessRounded);


