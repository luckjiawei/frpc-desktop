// export default function Logger(module?: string): ClassDecorator {
//   return function (target: Object) {
//     Object.defineProperty(target, "logger", {
//       value: new (require("../LoggerFactory").default)(module),
//       writable: true
//     });
//   };
// }
