import { Router, type IRouter } from "express";
import healthRouter from "./health";
import diagnosticsRouter from "./diagnostics";
import adminReferralsRouter from "./admin-referrals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(diagnosticsRouter);
router.use(adminReferralsRouter);

export default router;
