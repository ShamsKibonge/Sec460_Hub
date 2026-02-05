import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    createGroup,
    listMyGroups,
    listGroupMembers,
    addMemberByEmail,
} from "../../controllers/groups.controller.js";

const router = Router();

router.post("/", requireAuth, createGroup);
router.get("/", requireAuth, listMyGroups);
router.get("/:groupId/members", requireAuth, listGroupMembers);
router.post("/:groupId/members", requireAuth, addMemberByEmail);

export default router;
