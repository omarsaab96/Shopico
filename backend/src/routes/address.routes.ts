import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  createAddressHandler,
  deleteAddressHandler,
  listAddressHandler,
  updateAddressHandler,
} from "../controllers/addressController";

const router = Router();

router.use(authenticate);
router.get("/", listAddressHandler);
router.post("/", createAddressHandler);
router.put("/:id", updateAddressHandler);
router.delete("/:id", deleteAddressHandler);

export default router;
