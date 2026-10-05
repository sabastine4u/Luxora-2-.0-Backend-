const mongoose = require("mongoose");
require("dotenv").config();

const Conversation = require("../src/models/conversation.model");
const Inquiry = require("../src/models/inquiry.model");
const Agent = require("../src/models/agent.model");
const Agency = require("../src/models/agency.model");
const { COMMUNICATION } = require("../src/config/constants");

const DBSTRING = process.env.DBSTRING;
const APPLY = process.argv.includes("--apply");

if (!DBSTRING) {
  console.error("Missing DBSTRING environment variable.");
  process.exit(1);
}

const buildDirectKey = (leftUserId, rightUserId) =>
  [String(leftUserId), String(rightUserId)]
    .sort()
    .join(":");

const participantIds = (conversation) =>
  conversation.participants
    .map((participant) => String(participant))
    .sort();

const archiveParticipantState = (conversation) => {
  const archivedAt = new Date();

  conversation.participantState.forEach((state) => {
    state.archivedAt = archivedAt;
  });

  return conversation;
};

const chooseCanonical = (conversations) => {
  return [...conversations].sort((left, right) => {
    const leftHasKey =
      typeof left.directKey === "string" &&
      left.directKey;

    const rightHasKey =
      typeof right.directKey === "string" &&
      right.directKey;

    if (leftHasKey !== rightHasKey) {
      return leftHasKey ? -1 : 1;
    }

    const leftDate = new Date(
      left.lastMessageAt ||
        left.updatedAt ||
        left.createdAt,
    ).getTime();

    const rightDate = new Date(
      right.lastMessageAt ||
        right.updatedAt ||
        right.createdAt,
    ).getTime();

    return rightDate - leftDate;
  })[0];
};

const main = async () => {
  await mongoose.connect(DBSTRING);

  try {
    console.log(
      `Messaging migration mode: ${
        APPLY ? "APPLY" : "DRY RUN"
      }`,
    );

    /*
     * 1. Find active Direct conversations and group them
     *    by the unique pair of participants.
     */
    const directConversations =
      await Conversation.find({
        type:
          COMMUNICATION.CONVERSATION_TYPES
            .DIRECT,
        status:
          COMMUNICATION.CONVERSATION_STATUSES
            .ACTIVE,
      }).sort({
        lastMessageAt: -1,
        updatedAt: -1,
      });

    const directGroups = new Map();

    for (
      const conversation of directConversations
    ) {
      if (
        conversation.participants.length !== 2
      ) {
        continue;
      }

      const key = buildDirectKey(
        conversation.participants[0],
        conversation.participants[1],
      );

      if (!directGroups.has(key)) {
        directGroups.set(key, []);
      }

      directGroups
        .get(key)
        .push(conversation);
    }

    let canonicalDirectCount = 0;
    let duplicateDirectCount = 0;

    /*
     * 2. Keep one canonical Direct conversation
     *    for every user pair.
     */
    for (
      const [
        directKey,
        conversations,
      ] of directGroups.entries()
    ) {
      const canonical =
        chooseCanonical(
          conversations,
        );

      canonicalDirectCount += 1;

      console.log(
        `\nDIRECT ${directKey}`,
      );

      console.log(
        `  canonical: ${canonical._id}`,
      );

      if (
        APPLY &&
        canonical.directKey !==
          directKey
      ) {
        canonical.directKey =
          directKey;

        await canonical.save();

        console.log(
          "  -> directKey assigned",
        );
      } else if (
        !APPLY &&
        canonical.directKey !==
          directKey
      ) {
        console.log(
          "  -> would assign directKey",
        );
      }

      for (
        const duplicate of conversations
      ) {
        if (
          String(
            duplicate._id,
          ) ===
          String(
            canonical._id,
          )
        ) {
          continue;
        }

        duplicateDirectCount += 1;

        console.log(
          `  duplicate: ${duplicate._id} -> close/archive`,
        );

        if (APPLY) {
          duplicate.status =
            COMMUNICATION
              .CONVERSATION_STATUSES
              .CLOSED;

          archiveParticipantState(
            duplicate,
          );

          await duplicate.save();
        }
      }
    }

    /*
     * 3. Find legacy active Property Inquiry
     *    conversations.
     */
    const inquiryConversations =
      await Conversation.find({
        type:
          COMMUNICATION.CONVERSATION_TYPES
            .PROPERTY_INQUIRY,

        status:
          COMMUNICATION.CONVERSATION_STATUSES
            .ACTIVE,
      }).sort({
        lastMessageAt: -1,
        updatedAt: -1,
      });

    let inquiryArchivedCount = 0;

    for (
      const conversation of
        inquiryConversations
    ) {
      const inquiry =
        await Inquiry.findById(
          conversation.inquiry,
        )
          .select(
            "inquirer agent agency",
          )
          .lean();

      if (
        !inquiry ||
        !inquiry.inquirer
      ) {
        continue;
      }

      const [
        agent,
        agency,
      ] = await Promise.all([
        inquiry.agent
          ? Agent.findById(
              inquiry.agent,
            )
              .select("user")
              .lean()
          : null,

        inquiry.agency
          ? Agency.findById(
              inquiry.agency,
            )
              .select("user")
              .lean()
          : null,
      ]);

      const recipientIds = [
        agent?.user,
        agency?.user,
      ]
        .filter(Boolean)
        .map((value) =>
          String(value),
        );

      let matchedDirect = null;

      /*
       * 4. Only retire a legacy inquiry thread
       *    when a corresponding persistent Direct
       *    conversation already exists.
       */
      for (
        const recipientId of
          recipientIds
      ) {
        if (
          recipientId ===
          String(
            inquiry.inquirer,
          )
        ) {
          continue;
        }

        const directKey =
          buildDirectKey(
            inquiry.inquirer,
            recipientId,
          );

        matchedDirect =
          await Conversation.findOne({
            type:
              COMMUNICATION
                .CONVERSATION_TYPES
                .DIRECT,

            directKey,

            status:
              COMMUNICATION
                .CONVERSATION_STATUSES
                .ACTIVE,
          });

        if (matchedDirect) {
          break;
        }

        /*
         * Backward-compatible lookup for a Direct
         * conversation created before directKey.
         */
        matchedDirect =
          await Conversation.findOne({
            type:
              COMMUNICATION
                .CONVERSATION_TYPES
                .DIRECT,

            participants: {
              $all: [
                inquiry.inquirer,
                recipientId,
              ],

              $size: 2,
            },

            status:
              COMMUNICATION
                .CONVERSATION_STATUSES
                .ACTIVE,
          });

        if (matchedDirect) {
          break;
        }
      }

      if (!matchedDirect) {
        continue;
      }

      inquiryArchivedCount += 1;

      console.log(
        `\nLEGACY INQUIRY ${conversation._id}`,
      );

      console.log(
        `  participants: ${participantIds(
          conversation,
        ).join(", ")}`,
      );

      console.log(
        `  canonical direct: ${matchedDirect._id}`,
      );

      console.log(
        "  -> close/archive legacy inquiry thread",
      );

      if (APPLY) {
        conversation.status =
          COMMUNICATION
            .CONVERSATION_STATUSES
            .CLOSED;

        archiveParticipantState(
          conversation,
        );

        await conversation.save();
      }
    }

    console.log(
      "\nMigration summary",
    );

    console.log(
      `  Direct pairs inspected: ${canonicalDirectCount}`,
    );

    console.log(
      `  Duplicate Direct conversations: ${duplicateDirectCount}`,
    );

    console.log(
      `  Legacy inquiry threads retired: ${inquiryArchivedCount}`,
    );

    if (!APPLY) {
      console.log(
        "\nDRY RUN ONLY — no database records were changed.",
      );

      console.log(
        "Run with --apply only after reviewing the output.",
      );
    } else {
      console.log(
        "\nMigration applied successfully.",
      );
    }
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(
    "Messaging migration failed:",
    error,
  );

  mongoose
    .disconnect()
    .finally(() =>
      process.exit(1),
    );
});