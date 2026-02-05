import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import {
    getInbox,
    getGroupMessages,
    postGroupMessage,
    sendDirectMessage,
    getDirectMessages,
    markChatSeen,
    attachFileToGroup,
    attachFileToThread,
} from "../../controllers/messages.controller.js";

const router = Router();

router.get("/inbox", requireAuth, getInbox);

// group messages
router.get("/groups/:groupId", requireAuth, getGroupMessages);
router.post("/groups/:groupId", requireAuth, postGroupMessage);

// direct messages
router.post("/direct", requireAuth, sendDirectMessage);
router.get("/direct/:threadId", requireAuth, getDirectMessages);
router.post("/seen", requireAuth, markChatSeen);
router.post("/groups/:groupId/attach-file", requireAuth, attachFileToGroup);
router.post("/threads/:threadId/attach-file", requireAuth, attachFileToThread);


export default router;
