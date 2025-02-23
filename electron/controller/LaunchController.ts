import BaseController from "./BaseController";
import FrpcProcessService from "../service/FrpcProcessService";

class LaunchController extends BaseController {
  private readonly _frpcProcessService: FrpcProcessService;

  constructor(frpcProcessService: FrpcProcessService) {
    super();
    this._frpcProcessService = frpcProcessService;
  }

  launch(req: ControllerParam) {
    this._frpcProcessService.startFrpcProcess().then(r => {});
  }
}

export default LaunchController;