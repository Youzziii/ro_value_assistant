require("dotenv").config();
const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  MessageFlags,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

async function getCryptoUsdRate(currencyId) {
  const coinIds = {
    btc: "bitcoin",
    eth: "ethereum",
    ltc: "litecoin",
    sol: "solana",
  };

  const coinId = coinIds[currencyId];

  if (!coinId) {
    return 1;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );

    if (!response.ok) {
      throw new Error(
        `CoinGecko returned ${response.status}`
      );
    }

    const data = await response.json();

    const price = data?.[coinId]?.usd;

    if (
      typeof price !== "number" ||
      !Number.isFinite(price)
    ) {
      throw new Error(
        `Invalid price for ${currencyId}`
      );
    }

    return price;
  } catch (error) {
    console.error(
      `Could not fetch ${currencyId} USD rate:`,
      error
    );

    return null;
  }
}
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ================================
// CONFIGURATION
// ================================

const RULES_CHANNEL_ID = "1555883929184112692";
const AWARENESS_CHANNEL_ID = "1555883947987046430";

const RULES_GIF_PATH = "./vanta_central_main.gif";
const AWARENESS_GIF_PATH = "./vanta_central_thumbnail.gif";

const REACTION_ROLES_CHANNEL_ID = "1555883961333448775";
const VALUES_CHANNEL_ID = "1555883974075748422";
const TERMS_CHANNEL_ID = "1555883979285209139";
const WELCOME_CHANNEL_ID = "1555883985580720231";
const MM_TICKET_CATEGORY_ID = "1555883366056984596";
const MIDDLEMAN_ROLE_ID = "1555883213233332245";
const GIVEAWAY_ROLE_ID = "1555883108774051931";
const UPDATES_ROLE_ID = "1555883113312424017";
const BLACKLIST_ROLE_ID = "1555883104051265626";
const HITTER_ROLE_ID = "1555883166764503120";

const AUTOMIDDLEMAN_CHANNEL_ID = "1555883992023171144";
const AUTOMIDDLEMAN_GIF_PATH = AWARENESS_GIF_PATH;
const TEST_VOUCH_CHANNEL_ID = "1555883997786017822";
const TEST_VOUCH_MM_ROLE_ID = "1555883213233332245";
const TEST_TRADE_CHANNEL_ID = "1555884004052435054";
const TRADING_TOS_CHANNEL_ID = "1555884009450377237";
const TRADING_TOS_STATE_FILE = "./tradingTosState.json";
const TRADER_VERIFICATION_CHANNEL_ID = "1555884022566096896";
const TRADER_VERIFICATION_GIF_PATH = AWARENESS_GIF_PATH;
const TRADER_VERIFICATION_BOTTOM_GIF_PATH = RULES_GIF_PATH;
const TRADER_VERIFICATION_STATE_FILE = "./traderVerificationState.json";
const SUPPORT_PANEL_CHANNEL_ID = "1555884035824164874";
const SUPPORT_PANEL_GIF_PATH = AWARENESS_GIF_PATH;
const SUPPORT_PANEL_STATE_FILE = "./supportPanelState.json";
const MM_APPLICATION_CATEGORY_ID = "1555883391856025682";
const MM_APPLICATION_STAFF_ROLE_ID = "1555883244015321168";
const MM_APPLICATION_EXECUTIVE_ROLE_ID = "1555883345445920798";
const SUPPORT_TICKET_CATEGORY_ID = MM_APPLICATION_CATEGORY_ID;
const REPORT_USER_CATEGORY_ID = MM_APPLICATION_CATEGORY_ID;

const SUPPORT_TICKET_STAFF_ROLE_ID = MM_APPLICATION_STAFF_ROLE_ID;
const REPORT_USER_STAFF_ROLE_ID = MM_APPLICATION_STAFF_ROLE_ID;

const SUPPORT_TICKET_GIF_PATH = AWARENESS_GIF_PATH;
const REPORT_USER_GIF_PATH = AWARENESS_GIF_PATH;

// Role that may use .override to take over any ticket as full claimer
const OVERRIDE_ROLE_ID = "1556313435992752320";

const supportTicketClaims = new Map();
const reportUserClaims = new Map();
const SUPPORT_INFO_CHANNEL_ID = "1555884050705813616";
const SUPPORT_INFO_GIF_PATH = AWARENESS_GIF_PATH;
const SUPPORT_INFO_BOTTOM_GIF_PATH = RULES_GIF_PATH;
const SUPPORT_INFO_STATE_FILE = "./supportInfoState.json";
const TICKET_TRANSCRIPT_CHANNEL_ID = "1555884062688813146";
const SICK_EMOJI_CHANNEL_ID = "1555883723193327706";
const AUTO_ROLE_ID = "1555883128843935835";

const EXCLUDED_ROLE_IDS = new Set([
  "1555850909999697981",
  "1555883345445920798",
  "1555883177925546015",
  "1555883122619457556",
  "1555883195143159818",
  "1555883104051265626",
  "1555883108774051931",
  "1555883332850679808",
  "1555883118034948146",
  "1555883094802833469",
  "1555883089878847488",
  "1555883099643191316",
  "1555883113312424017",
]);

// Rollen die het .strip commando mogen gebruiken
const STRIP_ALLOWED_ROLE_IDS = new Set([
  "1556313435992752320",
  "1555850909999697981",
  "1555883345445920798",
]);

// Rollen die NIET verwijderd mogen worden tijdens .strip
const STRIP_KEPT_ROLE_IDS = new Set([
  "1555883166764503120",
  "1555883128843935835",
]);
// Stores saved roles for members who activated .temp
// Format: userId -> Array of role IDs
const tempSavedRoles = new Map();
// Roles that should NEVER be removed when running .temp
const TEMP_KEPT_ROLE_IDS = new Set([
  "1555883166764503120",
  "1555883128843935835",
  "1555850909999697981", // Added so this role is never removed
]);
// ============================================================
// JSON FILE HELPERS
// ============================================================

function loadJsonFile(file, fallback) {
  if (!fs.existsSync(file)) return fallback;

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    // Keep the unreadable file instead of silently overwriting it on the next save.
    const backup = `${file}.corrupt-${Date.now()}`;

    try {
      fs.copyFileSync(file, backup);
    } catch {
      // Nothing more we can do.
    }

    console.error(
      `[DATA] Could not read ${file}. Backed it up as ${backup} and starting empty.`,
      error
    );

    return fallback;
  }
}

// Writes to a temp file first so a crash mid-write cannot corrupt the data.
function saveJsonFile(file, data) {
  const temp = `${file}.tmp`;

  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
}

function randomString(length, characters) {
  let result = "";

  for (let i = 0; i < length; i++) {
    result += characters[Math.floor(Math.random() * characters.length)];
  }

  return result;
}

const ALPHANUMERIC =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
// ============================================================
// AUTO MIDDLEMAN 
// ============================================================

const AUTO_MM_COUNTER_FILE = "./autoMiddlemanCounter.json";
const AUTO_MM_START_NUMBER = 412342;

const savedAutoMmCounter = loadJsonFile(AUTO_MM_COUNTER_FILE, {});

let autoMmNextNumber =
  Number.isInteger(savedAutoMmCounter.nextNumber) &&
  savedAutoMmCounter.nextNumber >= AUTO_MM_START_NUMBER
    ? savedAutoMmCounter.nextNumber
    : AUTO_MM_START_NUMBER;

function saveAutoMmCounter() {
  saveJsonFile(AUTO_MM_COUNTER_FILE, {
    nextNumber: autoMmNextNumber,
  });
}

function getNextAutoMmTicketName() {
  const ticketName = `auto-${autoMmNextNumber}`;

  autoMmNextNumber += 1;

  saveAutoMmCounter();

  return ticketName;
}

function generateAutoMmCode() {
  return randomString(24, ALPHANUMERIC);
}

const autoMiddlemanStates = new Map();
// ============================================================
// STAFF ROLE LADDER
// ============================================================

const STAFF_BASE_ROLE_IDS = [
  MIDDLEMAN_ROLE_ID,
  "1555883218753028096",
  "1555883224595693568",
];

const NICKNAME_STAFF_ROLE_IDS = [
  "1555883231012847709",
  "1555883237614559306",
];

const WARN_STAFF_ROLE_ID = MM_APPLICATION_STAFF_ROLE_ID;

const KICK_STAFF_ROLE_ID =
  "1555883249736351794";

const EXPRESSION_STAFF_ROLE_IDS = [
  "1555883264592584714",
  "1555883256740708432",
  "1555883271907446784",
];

const BAN_STAFF_ROLE_ID =
  "1555883278064418856";

const CHANNEL_STAFF_ROLE_ID =
  "1555883285937127514";

const ROLE_STAFF_ROLE_ID =
  "1555883292987883543";

// ============================================================
// STAFF PERMISSION HELPERS
// ============================================================

// ============================================================
// ROLE FILL HELPERS
// ============================================================

function findMemberHighestRolePosition(member) {
  let maxPos = -1;
  for (const role of member.roles.cache.values()) {
    if (role.position > maxPos) {
      maxPos = role.position;
    }
  }
  return maxPos;
}

function findMemberLowestRolePosition(member) {
  let minPos = Infinity;
  for (const role of member.roles.cache.values()) {
    if (role.position < minPos) {
      minPos = role.position;
    }
  }
  return minPos === Infinity ? -1 : minPos;
}
function hasAnyRole(member, roleIds) {
  if (!member) return false;

  return roleIds.some((roleId) =>
    member.roles.cache.has(roleId)
  );
}

function getStaffLevel(member) {
  if (!member) return 0;

  // Level 8 — Role Staff
  if (
    member.roles.cache.has(
      ROLE_STAFF_ROLE_ID
    )
  ) {
    return 8;
  }

  // Level 7 — Channel Staff
  if (
    member.roles.cache.has(
      CHANNEL_STAFF_ROLE_ID
    )
  ) {
    return 7;
  }

  // Level 6 — Ban Staff
  if (
    member.roles.cache.has(
      BAN_STAFF_ROLE_ID
    )
  ) {
    return 6;
  }

  // Level 5 — Expression Staff
  if (
    hasAnyRole(
      member,
      EXPRESSION_STAFF_ROLE_IDS
    )
  ) {
    return 5;
  }

  // Level 4 — Kick Staff
  if (
    member.roles.cache.has(
      KICK_STAFF_ROLE_ID
    )
  ) {
    return 4;
  }

  // Level 3 — Warn Staff
  if (
    member.roles.cache.has(
      WARN_STAFF_ROLE_ID
    )
  ) {
    return 3;
  }

  // Level 2 — Nickname Staff
  if (
    hasAnyRole(
      member,
      NICKNAME_STAFF_ROLE_IDS
    )
  ) {
    return 2;
  }

  // Level 1 — Base Staff
  if (
    hasAnyRole(
      member,
      STAFF_BASE_ROLE_IDS
    )
  ) {
    return 1;
  }

  return 0;
}

function hasStaffLevel(
  member,
  requiredLevel
) {
  return (
    getStaffLevel(member) >=
    requiredLevel
  );
}

async function requireStaffLevel(
  message,
  requiredLevel,
  action
) {
  if (
    !message.guild ||
    !message.member
  ) {
    return false;
  }

  if (
    hasStaffLevel(
      message.member,
      requiredLevel
    )
  ) {
    return true;
  }

  // Someone who used .override is the full claimer of this ticket
  if (isTicketOverrider(message.member, message.channel.id)) {
    return true;
  }

  await message.channel.send(
    `You do not have permission to ${action}.`
  );

  return false;
}

function hasStaffLevelInteraction(
  interaction,
  requiredLevel
) {
  return (
    interaction.guild &&
    interaction.member &&
    (hasStaffLevel(
      interaction.member,
      requiredLevel
    ) ||
      isTicketOverrider(
        interaction.member,
        interaction.channel?.id
      ))
  );
}

// True when the member holds the override role AND is the current
// claimer of the ticket in this channel (i.e. they used .override).
function isTicketOverrider(member, channelId) {
  if (!member || !channelId) return false;
  if (!member.roles.cache.has(OVERRIDE_ROLE_ID)) return false;

  const state = ticketStates.get(channelId);

  return Boolean(state) && state.claimerId === member.id;
}

const MESSAGE_IDS_FILE = "./messageIds.json";

let messageIds = loadJsonFile(MESSAGE_IDS_FILE, {});

function saveMessageIds() {
  saveJsonFile(MESSAGE_IDS_FILE, messageIds);
}

// ============================================================
// VOUCH DATABASE
// ============================================================

const VOUCHES_FILE = "./vouches.json";

let vouches = loadJsonFile(VOUCHES_FILE, {});

function saveVouches() {
  saveJsonFile(VOUCHES_FILE, vouches);
}

const CUSTOM_VOUCHES_FILE = "./customVouches.json";

let customVouches = loadJsonFile(CUSTOM_VOUCHES_FILE, {});

function saveCustomVouches() {
  saveJsonFile(CUSTOM_VOUCHES_FILE, customVouches);
}
// ================================
// TICKET STATE
// ================================

const ticketStates = new Map();

// ============================================================
// RECEIPTS DATABASE
// ============================================================

const RECEIPTS_FILE = "./receipts.json";

let receipts = loadJsonFile(RECEIPTS_FILE, {});

function saveReceipts() {
  saveJsonFile(RECEIPTS_FILE, receipts);
}

// ============================================================
// TICKET TIMER STATE
// ============================================================

const TICKET_INACTIVITY_MS =
  30 * 60 * 1000;

const ticketTimers = new Map();

function parseDuration(input) {
  if (!input) return null;

  const match = input
    .toLowerCase()
    .trim()
    .match(
      /^(\d+(?:\.\d+)?)(s|m|h|d|w)$/
    );

  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  return Math.floor(
    amount * multipliers[unit]
  );
}

function formatDuration(ms) {
  const totalSeconds = Math.max(
    0,
    Math.floor(ms / 1000)
  );

  const days = Math.floor(
    totalSeconds / 86400
  );

  const hours = Math.floor(
    (totalSeconds % 86400) / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds =
    totalSeconds % 60;

  const parts = [];

  if (days) {
    parts.push(
      `${days} day${days === 1 ? "" : "s"}`
    );
  }

  if (hours) {
    parts.push(
      `${hours} hour${hours === 1 ? "" : "s"}`
    );
  }

  if (minutes) {
    parts.push(
      `${minutes} minute${minutes === 1 ? "" : "s"}`
    );
  }

  if (seconds || parts.length === 0) {
    parts.push(
      `${seconds} second${seconds === 1 ? "" : "s"}`
    );
  }

  return parts.join(", ");
}

function formatReceiptDate(timestamp) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Europe/Amsterdam",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  ).format(new Date(timestamp));
}

function generateReceiptId() {
  return `RCP-${randomString(6, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")}`;
}

function createUniqueReceiptId() {
  let id;

  do {
    id = generateReceiptId();
  } while (receipts[id]);

  return id;
}

// ============================================================
// TICKET INACTIVITY TIMER
// ============================================================

function clearTicketInactivityTimer(
  channelId
) {
  const existing =
    ticketTimers.get(channelId);

  if (existing) {
    clearTimeout(existing);
    ticketTimers.delete(channelId);
  }
}

function startTicketInactivityTimer(
  channel
) {
  const ticketState =
    ticketStates.get(channel.id);

  if (!ticketState) return;

  clearTicketInactivityTimer(
    channel.id
  );

  if (
    ticketState.inactivityHeld ||
    ticketState.escrowTimerUntil
  ) {
    return;
  }

  ticketState.lastActivity =
    Date.now();

  const timeout =
    setTimeout(async () => {
      const currentState =
        ticketStates.get(channel.id);

      if (!currentState) return;

      if (
        currentState.inactivityHeld ||
        currentState.escrowTimerUntil
      ) {
        return;
      }

      try {
        await closeTicketChannel(channel, {
          type: "Middleman",
          closedBy: null,
          reason:
            "Automatically closed after 30 minutes of inactivity",
        });
      } catch (error) {
        console.error(
          "Automatic ticket close error:",
          error
        );
      }

      ticketTimers.delete(
        channel.id
      );
    }, TICKET_INACTIVITY_MS);

  ticketTimers.set(
    channel.id,
    timeout
  );
}

function resetTicketInactivityTimer(
  channel
) {
  const ticketState =
    ticketStates.get(channel.id);

  if (!ticketState) return;

  ticketState.lastActivity =
    Date.now();

  startTicketInactivityTimer(
    channel
  );
}

// ============================================================
// WARNINGS DATABASE
// ============================================================

const WARNINGS_FILE = "./warnings.json";

let warnings = loadJsonFile(WARNINGS_FILE, {});

function saveWarnings() {
  saveJsonFile(WARNINGS_FILE, warnings);
}

function removeExpiredWarnings(userId) {
  if (!warnings[userId]) {
    return;
  }

  const now = Date.now();

  const WARNING_EXPIRY_MS =
    8 * 24 * 60 * 60 * 1000;

  warnings[userId] =
    warnings[userId].filter(
      (warning) =>
        now - warning.timestamp <
        WARNING_EXPIRY_MS
    );

  if (
    warnings[userId].length === 0
  ) {
    delete warnings[userId];
  }

  saveWarnings();
}

function generateWarningId() {
  return randomString(6, ALPHANUMERIC);
}

function createUniqueWarningId() {
  let id;

  do {
    id = generateWarningId();
  } while (
    Object.values(warnings).some((userWarnings) =>
      userWarnings.some(
        (warning) => warning.id === id
      )
    )
  );

  return id;
}
// ============================================================
// ROBLOX API HELPERS
// ============================================================

async function getRobloxUser(username) {
  const response = await fetch(
    "https://users.roblox.com/v1/usernames/users",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usernames: [username],
        excludeBannedUsers: false,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Roblox username lookup failed: ${response.status}`
    );
  }

  const data = await response.json();

  if (!data.data || data.data.length === 0) {
    return null;
  }

  return data.data[0];
}

async function getRobloxProfile(userId) {
  const response = await fetch(
    `https://users.roblox.com/v1/users/${userId}`
  );

  if (!response.ok) {
    throw new Error(
      `Roblox profile lookup failed: ${response.status}`
    );
  }

  return await response.json();
}

async function getRobloxFriends(userId) {
  const response = await fetch(
    `https://friends.roblox.com/v1/users/${userId}/friends/count`
  );

  if (!response.ok) {
    throw new Error(
      `Roblox friends lookup failed: ${response.status}`
    );
  }

  const data = await response.json();

  return data.count ?? 0;
}

async function getRobloxAvatar(userId) {
  const response = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
  );

  if (!response.ok) {
    throw new Error(
      `Roblox avatar lookup failed: ${response.status}`
    );
  }

  const data = await response.json();

  return data.data?.[0]?.imageUrl || null;
}

async function getRobloxPresence(userId) {
  const response = await fetch(
    "https://presence.roblox.com/v1/presence/users",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userIds: [Number(userId)],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Roblox presence lookup failed: ${response.status}`
    );
  }

  const data = await response.json();

  return data.userPresences?.[0] || null;
}

async function getRolimonsPlayer(userId) {
  const response = await fetch(
    `https://api.rolimons.com/players/v1/playerinfo/${userId}`
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

function buildAutoMmRoleContainer(state) {
  const sender =
    state.senderId
      ? `<@${state.senderId}>`
      : "`Waiting...`";

  const receiver =
    state.receiverId
      ? `<@${state.receiverId}>`
      : "`Waiting...`";

  return new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Role Assignment"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Both users must select their role for this deal."
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `<:Arrow:1555884377282453534> **Sending ${state.currencyName}**`,
          sender,
          "",
          `<:Arrow:1555884377282453534> **Receiving ${state.currencyName}**`,
          receiver,
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Vanta Central Middleman Service"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("auto_mm_role_sender")
          .setLabel("Sending")
          .setStyle(
            state.senderId
              ? ButtonStyle.Success
              : ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId("auto_mm_role_receiver")
          .setLabel("Receiving")
          .setStyle(
            state.receiverId
              ? ButtonStyle.Success
              : ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId("auto_mm_role_reset")
          .setLabel("Reset Roles")
          .setStyle(
            ButtonStyle.Danger
          )
      )
    );
}

function buildAutoMmRoleConfirmation(state) {
  return new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Confirm Roles"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Both users must confirm that the roles below are correct."
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `<:Arrow:1555884377282453534> **Sending ${state.currencyName}**`,
          `<@${state.senderId}>`,
          "",
          `<:Arrow:1555884377282453534> **Receiving ${state.currencyName}**`,
          `<@${state.receiverId}>`,
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Both users must confirm before continuing."
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("auto_mm_roles_correct")
          .setLabel("Correct")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("auto_mm_roles_incorrect")
          .setLabel("Incorrect")
          .setStyle(ButtonStyle.Secondary)
      )
    );
}
function buildAutoMmAmountContainer() {
  return new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Deal Amount"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "What is the **USD value** of this deal?",
          "",
          `<:Arrow:1555884377282453534> **Format**`,
          "Numbers only — no `$` signs or commas",
          "",
          `<:Arrow:1555884377282453534> **Example**`,
          "`50`  `150`  `1000.00`",
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Vanta Central Middleman Service"
      )
    );
}
function autoMmDivider() {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

function buildAutoMmAmountConfirmation(state) {
  return new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Confirm Deal Amount"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "Both users must confirm the USD amount of this deal.",
          "",
          `<:Arrow:1555884377282453534> **Amount**`,
          `$${state.dealAmount}`,
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Both users must confirm before continuing."
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("auto_mm_amount_correct")
          .setLabel("Correct")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("auto_mm_amount_incorrect")
          .setLabel("Incorrect")
          .setStyle(ButtonStyle.Secondary)
      )
    );
}

function buildAutoMmFeeContainer() {
  return new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Middleman Fee"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**Who will cover the Middleman fee?**",
          "",
          "> The fee is collected from the final amount once the deal is complete.",
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `<:Arrow:1555884377282453534> **Fee**`,
          "`$0.50 USD`",
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Vanta Central Middleman Service"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            "auto_mm_fee_sender"
          )
          .setLabel("Sender Pays")
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            "auto_mm_fee_receiver"
          )
          .setLabel("Receiver Pays")
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            "auto_mm_fee_split"
          )
          .setLabel("Split 50/50")
          .setStyle(
            ButtonStyle.Success
          )
      )
    );
}

function buildAutoMmFeeConfirmation(state) {
  let feeText;

  if (state.feeType === "sender") {
    feeText =
      `<@${state.senderId}> covers the full fee of **\`$0.50 USD\`**.`;
  } else if (state.feeType === "receiver") {
    feeText =
      `<@${state.receiverId}> covers the full fee of **\`$0.50 USD\`**.`;
  } else {
    feeText =
      "Both users split the fee — **`$0.25 USD`** each.";
  }

  return new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Confirm Fee Payment"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `${feeText}\n\n**Both users must confirm to continue.**`
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Vanta Central Middleman Service"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("auto_mm_fee_correct")
          .setLabel("Correct")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("auto_mm_fee_change")
          .setLabel("Change")
          .setStyle(ButtonStyle.Secondary)
      )
    );
}

function buildAutoMmSummary(state) {
  return new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Deal Summary"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "Review the deal details below. If anything is incorrect, contact staff immediately.",
          "",
          `<:Arrow:1555884377282453534> **Sender**`,
          `<@${state.senderId}>`,
          "",
          `<:Arrow:1555884377282453534> **Receiver**`,
          `<@${state.receiverId}>`,
          "",
          `<:Arrow:1555884377282453534> **Deal Value**`,
          `$${state.dealAmount}`,
          "",
          `<:Arrow:1555884377282453534> **Currency**`,
state.currencyNetwork
  ? `\`${state.currencyName} • ${state.currencyNetwork}\``
  : `\`${state.currencyName}\``,
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Vanta Central Middleman Service"
      )
    );
}

function buildAutoMmTestInvoice(state, rate) {
 const rateText =
  rate !== null
    ? `$${rate.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "Unavailable";
  const dealUsd = Number(state.dealAmount);

  const coinAmountText =
    rate !== null && rate > 0 && Number.isFinite(dealUsd)
      ? `${(dealUsd / rate).toFixed(rate === 1 ? 2 : 8)} ${state.currencySymbol}`
      : "Rate unavailable";
      const placeholderTexts = {
    btc: {
      address: "bc1q20hd7wt7enhzjxphnv0asc4s53q77xnchezmgx",
    },
    eth: {
      address: "0x0C188782A4C0eD1a5879Dbd8A444F866f1d6bEDa",
    },
    ltc: {
      address: "ltc1q0ud9q78mk32pdrjtz54266pj8m49ggy57p7dmz",
    },
    sol: {
      address: "7AKgcsaptaGtunURhXK23XazWoqcNtqDRNCme9fk1CWW",
    },
    usdt_bsc: {
      address: "0x0C188782A4C0eD1a5879Dbd8A444F866f1d6bEDa",
    },
    usdt_eth: {
      address: "0x0C188782A4C0eD1a5879Dbd8A444F866f1d6bEDa",
    },
    usdt_sol: {
      address: "7AKgcsaptaGtunURhXK23XazWoqcNtqDRNCme9fk1CWW",
    },
    usdc_eth: {
      address: "0x0C188782A4C0eD1a5879Dbd8A444F866f1d6bEDa",
    },
    usdc_sol: {
      address: "7AKgcsaptaGtunURhXK23XazWoqcNtqDRNCme9fk1CWW",
    },
  };

  const placeholder = placeholderTexts[state.currencyId] || {
    address: "N/A",
    amount: "N/A",
  };

  return new ContainerBuilder()
    .setAccentColor(0x3b82f6)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Payment Invoice"
      )
    )
    .addSeparatorComponents(
      autoMmDivider()
    )
   .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `<@${state.senderId}> — send the **exact** amount below to the escrow wallet address.`,
          "",
          `<:Arrow:1555884377282453534> **Wallet Address**`,
          `\`${placeholder.address}\``,
          "",
          `<:Arrow:1555884377282453534> **Amount to Send**`,
          `\`${coinAmountText}\``,
        ].join("\n")
      )
    )
    .addSeparatorComponents(
      autoMmDivider()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Rate: 1 ${state.currencySymbol} = ${rateText}`
      )
    );
}
// ================================
// CLIENT READY
// ================================

client.once("ready", async () => {
  console.log(`Bot is online as ${client.user.tag}`);
  await sendSupportInfoOnce();
  await sendTraderVerificationOnce();
  await sendSupportPanelOnce();

  try {
    await sendTradingTosOnce();
  } catch (error) {
    console.error("[TOS] ERROR:", error);
  }

  try {
    // ============================================================
    // SHARED COMPONENTS
    // ============================================================

    const divider = new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small);

    // ============================================================
    // 1. VANTA CENTRAL RULES
    // ============================================================

    const rulesChannel = await client.channels.fetch(RULES_CHANNEL_ID);

    if (!rulesChannel || !rulesChannel.isTextBased()) {
      throw new Error("Rules channel could not be found.");
    }

 const rulesThumbnailGif = new AttachmentBuilder(
  AWARENESS_GIF_PATH
).setName("vanta_central_thumbnail.gif");

const rulesMainGif = new AttachmentBuilder(
  RULES_GIF_PATH
).setName("vanta_central_main.gif");

    const rulesText = new TextDisplayBuilder().setContent(
      [
        "**Vanta Central | Rules & Guidelines**",
        "",
        "1. **`・` Follow Discord ToS and Guidelines**",
        "> We're on Discord's platform, therefore we'll automatically follow their regulations. Make sure you don't violate their terms and guidelines.",
        "",
        "2. **`・` Personal Information**",
        "> Do not post personal information about anyone without their consent. Any impersonation within MMs or other members are also not allowed.",
        "",
        "3. **`・` Content Appropriate**",
        "> All content should be safe for work and appropriate for the server’s community. No NSFW, graphic, or disturbing content.",
        "",
        "4. **`・` Use the Correct Channels**",
        "> Post messages, images, and discussions in the appropriate channels. Read channel descriptions and rules to avoid clutter.",
        "",
        "5. **`・` No Illegal Activities**",
        "> Sharing, discussing, or promoting illegal activities is strictly prohibited. This includes piracy, hacking, and any other form of illegal behavior.",
        "",
        "6. **`・` Respect Privacy**",
        "> Do not share personal information (yours or others) without consent. Respect everyone’s privacy.",
        "",
        "7. **`・` No Impersonation**",
        "> Do not impersonate other members, including server staff, celebrities, or other users.",
        "",
        "8. **`・` Follow Discord's Terms of Service**",
        "> All members must adhere to Discord's Terms of Service and Community Guidelines.",
        "> https://discord.com/terms",
        "",
        "9. **`・` Listen to Staff**",
        "> Staff decisions are final. If you have issues or concerns, contact a staff member privately and respectfully.",
        "",
        "10. **`・` We are NOT Responsible**",
        "> We are not responsible when one of our members scams you and when one of our server ad buyers scams you. This means that going first in one of their trades is YOUR OWN RISK! If you get scammed by one of them, DM an owner and we will take the ad down as fast as possible.",
        "",
        "11. **`・` Server Ads**",
        "> We do NOT refund purchased server ads. Breaking the server's rules and getting banned will lead to an ad removal with no refunds.",
      ].join("\n")
    );

    const rulesGifGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setURL("attachment://vanta_central_main.gif")
        .setDescription("Vanta Central")
    );

    const rulesButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Discord TOS")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.com/terms"),

      new ButtonBuilder()
        .setLabel("Discord Guidelines")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.com/guidelines")
    );

    const rulesContainer = new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

   .addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Vanta Central Rules & Guidelines"
      )
    )
    .setThumbnailAccessory(
      new ThumbnailBuilder()
        .setURL("attachment://vanta_central_thumbnail.gif")
        .setDescription("Vanta Central Rules")
    )
)

      // Real divider
      .addSeparatorComponents(divider)

      // All rules in one continuous text component
      .addTextDisplayComponents(rulesText)

      // Real divider
      .addSeparatorComponents(divider)

      // Existing GIF
      .addMediaGalleryComponents(rulesGifGallery)

      // Real divider
      .addSeparatorComponents(divider)

      // Footer
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      )

      // Buttons
      .addActionRowComponents(rulesButtons);
if (!messageIds.rulesMessageId) {
  const rulesMessage = await rulesChannel.send({
    components: [rulesContainer],
    files: [rulesThumbnailGif, rulesMainGif],
    flags: MessageFlags.IsComponentsV2,
  });

  messageIds.rulesMessageId = rulesMessage.id;
  saveMessageIds();

  console.log("Vanta Central rules message sent.");
} else {
  console.log("Vanta Central rules message already exists. Skipping.");
}

    

    // ============================================================
    // 2. VANTA CENTRAL SCAM AWARENESS GUIDE
    // ============================================================

    const awarenessChannel = await client.channels.fetch(
      AWARENESS_CHANNEL_ID
    );

    if (!awarenessChannel || !awarenessChannel.isTextBased()) {
      throw new Error("Awareness channel could not be found.");
    }

    const awarenessGif = new AttachmentBuilder(AWARENESS_GIF_PATH).setName(
      "vanta_central_thumbnail.gif"
    );

    const awarenessTitle = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Vanta Central | Scam Awareness Guide"
        )
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL("attachment://vanta_central_thumbnail.gif")
          .setDescription("Vanta Central Scam Awareness")
      );

    const awarenessText = new TextDisplayBuilder().setContent(
  [
    "**Common Scams in Roblox and Discord Communities (2025 Guide)**",
    "> This document outlines the most prevalent scams targeting Roblox players and Discord users.",
    "> Use it to educate community members, moderators, and developers about identifying and preventing fraudulent activity.",
    "",
    "1. **`・` Free Robux and Giveaway Scams**",
    "> **Purpose:** To steal Roblox account credentials or personal information.",
    "> **Description:** Scammers promote \"free Robux,\" \"limiteds,\" or \"headless giveaways\" through messages, Discord servers, or fake websites.",
    "",
    "> **Warning Signs:**",
    "> External links that do not end with \"roblox.com.\"",
    "> Promises of large Robux rewards.",
    "> Urgent or secretive messages.",
    "",
    "2. **`・` Impersonation of Roblox Staff or Developers**",
    "> **Purpose:** To gain trust and extract sensitive information.",
    "> **Description:** Individuals pretend to be Roblox employees, moderators, or official developers.",
    "",
    "> **Warning Signs:**",
    "> Claims of being \"Roblox Support\" or \"QA Tester.\"",
    "> Requests for login, verification, or cookie data.",
    "> Use of staff-like usernames or fake verification badges.",
    "",
    "3. **`・` Limited Item and Robux Trading Scams**",
    "> **Purpose:** To obtain items or currency through deceit.",
    "> **Description:** Scammers propose trading limiteds or Robux outside Roblox's official systems.",
    "",
    "> **Warning Signs:**",
    "> Offers of discounted limiteds or \"cheap headless\" items.",
    "> Use of \"trusted middlemen.\"",
    "> Requests to trade through Discord rather than the Roblox trade system.",
  ].join("\n")
);

    const awarenessRulesGif = new AttachmentBuilder(RULES_GIF_PATH).setName(
      "vanta_central_main.gif"
    );

    const awarenessGifGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setURL("attachment://vanta_central_main.gif")
        .setDescription("Vanta Central")
    );

    const awarenessContainer = new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      // Title + awareness GIF on the right
      .addSectionComponents(awarenessTitle)

      // Real divider
      .addSeparatorComponents(divider)

      // Guide text
      .addTextDisplayComponents(awarenessText)

      // Real divider
      .addSeparatorComponents(divider)

      // Existing rules GIF
      .addMediaGalleryComponents(awarenessGifGallery)

      // Real divider
      .addSeparatorComponents(divider)

      // Footer
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      );

if (!messageIds.awarenessMessageId) {
  const awarenessMessage = await awarenessChannel.send({
    components: [awarenessContainer],
    files: [awarenessGif, awarenessRulesGif],
    flags: MessageFlags.IsComponentsV2,
  });

  messageIds.awarenessMessageId = awarenessMessage.id;
  saveMessageIds();

  console.log("Vanta Central scam awareness message sent.");
} else {
  console.log("Vanta Central scam awareness message already exists. Skipping.");
}
        // ============================================================
    // 3. VANTA CENTRAL REACTION ROLES
    // ============================================================

    const reactionRolesChannel = await client.channels.fetch(
      REACTION_ROLES_CHANNEL_ID
    );

    if (!reactionRolesChannel || !reactionRolesChannel.isTextBased()) {
      throw new Error("Reaction roles channel could not be found.");
    }

   const reactionRolesGif = new AttachmentBuilder(
  AWARENESS_GIF_PATH
).setName("vanta_central_thumbnail.gif");

const reactionRolesMainGif = new AttachmentBuilder(
  RULES_GIF_PATH
).setName("vanta_central_main.gif");

    const reactionRolesTitle = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Vanta Central | Reaction Roles"
        )
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL("attachment://vanta_central_thumbnail.gif")
          .setDescription("Vanta Central")
      );

    const reactionRolesText = new TextDisplayBuilder().setContent(
      [
        "Click on the following button to receive its role.",
        "",
        "`・` **Additional Notes**",
        "> You can remove roles at all times. Click button again to remove the role.",
      ].join("\n")
    );

    const reactionRoleButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("reaction_role_giveaway")
        .setLabel("Giveaway Ping")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("reaction_role_updates")
        .setLabel("Updates Ping")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("reaction_role_blacklist")
        .setLabel("Blacklist Ping")
        .setStyle(ButtonStyle.Secondary)
    );

    const reactionRolesGifGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setURL("attachment://vanta_central_main.gif")
        .setDescription("Vanta Central")
    );

    const reactionRolesContainer = new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      // Title + GIF on the right
      .addSectionComponents(reactionRolesTitle)

      // Divider
      .addSeparatorComponents(divider)

      // Instructions
      .addTextDisplayComponents(reactionRolesText)

      // Divider
      .addSeparatorComponents(divider)

      // GIF
      .addMediaGalleryComponents(reactionRolesGifGallery)

      // Divider
      .addSeparatorComponents(divider)

      // Footer
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      )

      // Buttons
      .addActionRowComponents(reactionRoleButtons);

   if (!messageIds.reactionRolesMessageId) {
  const reactionRolesMessage = await reactionRolesChannel.send({
    components: [reactionRolesContainer],
    files: [reactionRolesGif, reactionRolesMainGif],
    flags: MessageFlags.IsComponentsV2,
  });

  messageIds.reactionRolesMessageId = reactionRolesMessage.id;
  saveMessageIds();

  console.log("Vanta Central reaction roles message sent.");
} else {
  console.log("Vanta Central reaction roles message already exists. Skipping.");
}

    const valuesChannel = await client.channels.fetch(
      VALUES_CHANNEL_ID
    );

    if (!valuesChannel || !valuesChannel.isTextBased()) {
      throw new Error("channel could not be found.");
    }

 const valuesThumbnailGif = new AttachmentBuilder(
  AWARENESS_GIF_PATH
).setName("vanta_central_thumbnail.gif");

const valuesMainGif = new AttachmentBuilder(
  RULES_GIF_PATH
).setName("vanta_central_main.gif");

    const valuesTitle = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Vanta Central | Roblox Values"
        )
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL("attachment://vanta_central_thumbnail.gif")
          .setDescription("Vanta Central")
      );

    const valuesText = new TextDisplayBuilder().setContent(
      "> We are partnered with **mm2values, adoptmevalues** and **petsimulatorvalues**. Click the links shown above to be redirected to their websites."
    );

    const valuesButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Adopt Me")
        .setStyle(ButtonStyle.Link)
        .setURL("https://adoptmevalues.gg/"),

      new ButtonBuilder()
        .setLabel("Murder Mystery 2")
        .setStyle(ButtonStyle.Link)
        .setURL("https://www.mm2values.com/"),

      new ButtonBuilder()
        .setLabel("Pet Simulator / GAG")
        .setStyle(ButtonStyle.Link)
        .setURL(
          "https://petsimulatorvalues.com/values.php?category=all"
        )
    );

    const valuesGifGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setURL("attachment://vanta_central_main.gif")
        .setDescription("Vanta Central")
    );

    const valuesContainer = new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      // Title + GIF on the right
      .addSectionComponents(valuesTitle)

      // Divider
      .addSeparatorComponents(divider)

      // Partnership text
      .addTextDisplayComponents(valuesText)

      // Divider
      .addSeparatorComponents(divider)

      // GIF
      .addMediaGalleryComponents(valuesGifGallery)

      // Divider
      .addSeparatorComponents(divider)

      // Footer
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      )

      // Divider
      .addSeparatorComponents(divider)

      // Website buttons
      .addActionRowComponents(valuesButtons);

    if (!messageIds.valuesMessageId) {
  const valuesMessage = await valuesChannel.send({
    components: [valuesContainer],
    files: [valuesThumbnailGif, valuesMainGif],
    flags: MessageFlags.IsComponentsV2,
  });

  messageIds.valuesMessageId = valuesMessage.id;
  saveMessageIds();

  console.log("message sent.");
} else {
  console.log("message already exists. Skipping.");
}
        // ============================================================
    // 5. MIDDLEMAN TERMS OF SERVICE
    // ============================================================

    const termsChannel = await client.channels.fetch(
      TERMS_CHANNEL_ID
    );

    if (!termsChannel || !termsChannel.isTextBased()) {
      throw new Error("Middleman Terms channel could not be found.");
    }

  const termsThumbnailGif = new AttachmentBuilder(
  AWARENESS_GIF_PATH
).setName("vanta_central_thumbnail.gif");

const termsMainGif = new AttachmentBuilder(
  RULES_GIF_PATH
).setName("vanta_central_main.gif");

    const termsTitle = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Vanta Central | Middleman Terms of Service"
        )
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL("attachment://vanta_central_thumbnail.gif")
          .setDescription("Vanta Central Middleman")
      );

    const termsText = new TextDisplayBuilder().setContent(
      [
        "## Please Read Carefully",
        "> By opening a ticket and using our **Middleman Services**, you confirm that you have read and",
        "> __agreed__ to every term listed below.",
        "",
        "### 1 · Responsibility Disclaimer",
        "> We are not responsible for losses that are __not the Middleman's fault__.",
        "> *Examples:* incorrect crypto address, wrong PayPal email, wrong gamepass link, or",
        "> misspelled Roblox usernames during Limiteds trades.",
        "",
        "### 2 · AFK Middlemen",
        "> If a Middleman goes **AFK** mid-trade, they are temporarily handling real-life matters.",
        "> They will return within a few hours and you will be __pinged__ the moment they are back.",
        "",
        "### 3 · AFK Traders",
        "> We are not **responsible** if either trader goes AFK.",
        "> This includes the return of items to the seller when the buyer is AFK and has not delivered",
        "> their side.",
        "",
        "### 4 · Vouching Requirement",
        "> You **must __vouch__** the Middleman after every completed trade.",
        "> Failure to vouch within **24 hours** may result in a __blacklist__ from our Middleman Service.",
      ].join("\n")
    );

    const termsFooter = new TextDisplayBuilder().setContent(
      "-# Opening a Middleman ticket constitutes acceptance of these terms."
    );

    const termsServiceFooter = new TextDisplayBuilder().setContent(
      "-# Vanta Central Middleman Service"
    );

    const termsGifGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setURL("attachment://vanta_central_main.gif")
        .setDescription("Vanta Central")
    );

    const termsContainer = new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      // Title + GIF on the right
      .addSectionComponents(termsTitle)

      // Divider
      .addSeparatorComponents(divider)

      // Terms
      .addTextDisplayComponents(termsText)

      // Footer before GIF
      .addTextDisplayComponents(termsFooter)

      // Divider
      .addSeparatorComponents(divider)

      .addMediaGalleryComponents(termsGifGallery)

      // Divider
      .addSeparatorComponents(divider)

      // Final footer
      .addTextDisplayComponents(termsServiceFooter);

   if (!messageIds.termsMessageId) {
  const termsMessage = await termsChannel.send({
    components: [termsContainer],
    files: [termsThumbnailGif, termsMainGif],
    flags: MessageFlags.IsComponentsV2,
  });

  messageIds.termsMessageId = termsMessage.id;
  saveMessageIds();

  console.log("Middleman Terms of Service message sent.");
} else {
  console.log("Middleman Terms of Service message already exists. Skipping.");
}

        // ============================================================
    // 6. WELCOME TO OUR MM SERVICE
    // ============================================================

    const welcomeChannel = await client.channels.fetch(
      WELCOME_CHANNEL_ID
    );

    if (!welcomeChannel || !welcomeChannel.isTextBased()) {
      throw new Error("Welcome channel could not be found.");
    }

    // Only send this message if it has not already been sent
    if (!messageIds.welcomeMessageId) {
   const welcomeThumbnailGif = new AttachmentBuilder(
  AWARENESS_GIF_PATH
).setName("vanta_central_thumbnail.gif");

const welcomeMainGif = new AttachmentBuilder(
  RULES_GIF_PATH
).setName("vanta_central_main.gif");

      const welcomeTitle = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "## Vanta Central | Welcome to Our MM Service"
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL("attachment://vanta_central_thumbnail.gif")
            .setDescription("Vanta Center Middleman Service")
        );

      const welcomeText = new TextDisplayBuilder().setContent(
        [
          "**Request Middleman**",
          "> Read our https://discord.com/channels/1173218193389662238/1555883979285209139 first, then tap **Request Middleman** and fill out the form.",
          "",
          "**Vouch Required**",
          "> You must vouch your middleman after the trade. Failing to do so within __24 hours__",
          "> results in a **Blacklist** from our MM Service.",
          "",
          "**Troll Tickets**",
          "> Creating any form of troll tickets will result in a **Middleman ban**.",
          "",
          "**Disclaimer**",
          "> We are **NOT** responsible for anything that happens after the trade is done.",
        ].join("\n")
      );

      const requestMiddlemanButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("request_middleman")
          .setLabel("Request Middleman")
          .setStyle(ButtonStyle.Primary)
      );

      const welcomeContainer = new ContainerBuilder()
        .setAccentColor(0x8b5cf6)

        // Title + GIF
        .addSectionComponents(welcomeTitle)

        // Divider
        .addSeparatorComponents(divider)

        // Information
        .addTextDisplayComponents(welcomeText)

        // Divider
        .addSeparatorComponents(divider)

        // Footer
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "-# Vanta Central Middleman Service"
          )
        )

        // Divider
        .addSeparatorComponents(divider)

        // Request button
        .addActionRowComponents(requestMiddlemanButton);

      const welcomeMessage = await welcomeChannel.send({
        components: [welcomeContainer],
        files: [welcomeThumbnailGif, welcomeMainGif],
        flags: MessageFlags.IsComponentsV2,
      });

      messageIds.welcomeMessageId = welcomeMessage.id;
      saveMessageIds();

      console.log("Welcome MM message sent.");
    } else {
      console.log("Welcome MM message already exists. Skipping.");
    }
  } catch (error) {
    console.error("Failed to send messages:");
    console.error(error);
  }
});

// ================================
// PREFIX COMMANDS
// ================================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;


// ============================================================
// .strip @user
// ============================================================


if (message.content.trim().startsWith(".strip")) {
  
  if (!message.guild || !message.member) return;

  // 1. Check if the command executor has any of the allowed roles
  const hasPermission = message.member.roles.cache.some((role) =>
    STRIP_ALLOWED_ROLE_IDS.has(role.id)
  );

  if (!hasPermission) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }

  // 2. Get the target member mentioned in the message
  const targetMember = message.mentions.members.first();
  if (!targetMember) {
    await message.channel.send("Usage: `.strip @user`");
    return;
  }

  // 3. Filter out roles that are NOT in the kept list
  const rolesToRemove = targetMember.roles.cache.filter(
    (role) =>
      !STRIP_KEPT_ROLE_IDS.has(role.id) &&
      !role.managed &&
      role.name !== "@everyone"
  );

  if (rolesToRemove.size === 0) {
    await message.channel.send("This user does not have any removable roles.");
    return;
  }

  try {
    await targetMember.roles.remove(rolesToRemove);
    await message.channel.send(
      `Successfully removed ${rolesToRemove.size} role(s) from <@${targetMember.id}>.`
    );
  } catch (error) {
    console.error("Failed to execute .strip command:", error);
    await message.channel.send(
      "Failed to remove roles. Check bot permissions and role hierarchy."
    );
  }

  
  return;
}

// ============================================================
// .override (Silent) — take over a ticket as its full claimer
// ============================================================

if (message.content.trim() === ".override") {
  if (!message.guild || !message.member) return;

  const deleteTrigger = async () => {
    if (message.deletable) await message.delete().catch(() => {});
  };

  // Only the override role may use this
  if (!message.member.roles.cache.has(OVERRIDE_ROLE_ID)) {
    await deleteTrigger();
    return;
  }

  const channelId = message.channel.id;
  const overriderId = message.author.id;

  const ticketState = ticketStates.get(channelId);

  // Support / report / application tickets use simple claim maps
  const claimMap = [
    supportTicketClaims,
    reportUserClaims,
    middlemanApplicationClaims,
  ].find((map) => map.has(channelId));

  if (!ticketState && !claimMap) {
    // Not a ticket channel
    await deleteTrigger();
    return;
  }

  try {
    // Make the overrider the claimer
    if (claimMap) {
      claimMap.set(channelId, overriderId);
    }

    if (ticketState) {
      ticketState.claimerId = overriderId;
    }

    // Make sure the overrider can see and talk in the ticket
    await message.channel.permissionOverwrites.edit(overriderId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
    });

    // Middleman tickets: switch the buttons from "Claim" to "Unclaim"
    if (ticketState?.claimMessageId) {
      try {
        const claimMessage = await message.channel.messages.fetch(
          ticketState.claimMessageId
        );

        await claimMessage.edit({
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("middleman_claim")
                .setLabel("Claim")
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId("middleman_unclaim")
                .setLabel("Unclaim")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId("middleman_close")
                .setLabel("Close")
                .setStyle(ButtonStyle.Danger)
            ),
          ],
        });
      } catch (error) {
        console.error("[.override] Could not update claim buttons:", error);
      }
    }

    if (ticketState) {
      resetTicketInactivityTimer(message.channel);
    }
  } catch (error) {
    console.error("[.override] Failed:", error);
  }

  // Keep the channel clean: the command itself stays silent
  await deleteTrigger();

  return;
}

  // ============================================================
// .givemember
// ============================================================

if (message.content.trim() === ".givemember") {
  if (!message.guild || !message.member) return;

  // Controleer of de gebruiker de vereiste rol (HITTER_ROLE_ID) of hoger heeft
  const requiredRole = message.guild.roles.cache.get(HITTER_ROLE_ID);
  if (!requiredRole) {
    await message.channel.send("Vereiste rol voor dit commando is niet gevonden.");
    return;
  }

  const userHighestPos = findMemberHighestRolePosition(message.member);
  if (userHighestPos < requiredRole.position) {
    await message.channel.send("Je hebt geen toestemming om dit commando te gebruiken.");
    return;
  }

  const roleIdToAssign = "1555883128843935835";
  const targetRole = message.guild.roles.cache.get(roleIdToAssign);

  if (!targetRole) {
    await message.channel.send(`Rol met ID \`${roleIdToAssign}\` is niet gevonden in de server.`);
    return;
  }

  const statusMsg = await message.channel.send("Leden ophalen en verwerken...");

  try {
    // Haal alle leden op uit de server
    const members = await message.guild.members.fetch();

    // Filter leden die de rol nog NIET hebben en geen bots zijn
    const membersToAssign = Array.from(
      members.filter((member) => !member.user.bot && !member.roles.cache.has(roleIdToAssign)).values()
    );

    const totalMembers = membersToAssign.length;

    if (totalMembers === 0) {
      await statusMsg.edit("Iedereen heeft deze rol al!");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    await statusMsg.edit(
      `Starten met toewijzen van <@&${roleIdToAssign}>... Status: **0/${totalMembers}**`
    );

    for (let i = 0; i < totalMembers; i++) {
      const member = membersToAssign[i];

      try {
        await member.roles.add(targetRole);
        successCount++;
      } catch (err) {
        console.error(`Mislukt om rol te geven aan ${member.user.tag}:`, err);
        failCount++;
      }

      const currentStep = i + 1;

      // Update het statusbericht elke 5 leden of bij de allerlaatste
      if (currentStep % 5 === 0 || currentStep === totalMembers) {
        await statusMsg.edit(
          `Bezig met toewijzen van <@&${roleIdToAssign}>... Status: **${currentStep}/${totalMembers}**`
        ).catch(() => {});
      }

      // Kleine pauze van 250ms om Discord rate-limits te voorkomen
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    await message.channel.send(
      `Voltooid! Rol <@&${roleIdToAssign}> is succesvol gegeven aan **${successCount}** van de **${totalMembers}** leden. (Mislukt: ${failCount})`
    );
  } catch (error) {
    console.error("Fout bij uitvoeren van .givemember:", error);
    await message.channel.send("Er is een fout opgetreden bij het verwerken van de leden.");
  }

  return;
}
  // ============================================================
// .temp
// ============================================================

if (message.content.trim() === ".temp") {
  if (!message.guild || !message.member) return;

  // Check if the user has the required permission role
  const REQUIRED_TEMP_ROLE_ID = "1555883213233332245";
  if (!message.member.roles.cache.has(REQUIRED_TEMP_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }

  const userId = message.author.id;

  // CASE 1: User already ran .temp -> Restore original roles
  if (tempSavedRoles.has(userId)) {
    const originalRoleIds = tempSavedRoles.get(userId);

    // Find all valid roles in the guild that the user originally had
    const rolesToRestore = originalRoleIds
      .map((roleId) => message.guild.roles.cache.get(roleId))
      .filter((role) => role && !role.managed && role.name !== "@everyone");

    try {
      await message.member.roles.add(rolesToRestore);
      tempSavedRoles.delete(userId); // Clear saved state after restoring

      await message.channel.send(
        `Welcome back! Restored original roles for <@${userId}>.`
      );
    } catch (error) {
      console.error("Failed to restore roles in .temp:", error);
      await message.channel.send(
        "Failed to restore your roles. Check bot permissions and role hierarchy."
      );
    }
    return;
  }

  // CASE 2: User hasn't ran .temp yet -> Save roles and strip extra roles
  const currentRoles = message.member.roles.cache;

  // Store all current role IDs for restoration later
  const savedRoleIds = currentRoles
    .filter((role) => role.name !== "@everyone")
    .map((role) => role.id);

  if (savedRoleIds.length === 0) {
    await message.channel.send("You have no removable roles.");
    return;
  }

  // Identify roles to remove (all roles EXCEPT the kept ones)
  const rolesToRemove = currentRoles.filter(
    (role) =>
      !TEMP_KEPT_ROLE_IDS.has(role.id) &&
      !role.managed &&
      role.name !== "@everyone"
  );

  if (rolesToRemove.size === 0) {
    await message.channel.send("You only have kept roles assigned.");
    return;
  }

  try {
    // Save current state first
    tempSavedRoles.set(userId, savedRoleIds);

    // Strip roles
    await message.member.roles.remove(rolesToRemove);
    await message.channel.send(
      `Temporary mode active for <@${userId}>. Removed ${rolesToRemove.size} role(s). Run \`.temp\` again to restore them.`
    );
  } catch (error) {
    console.error("Failed to remove roles in .temp:", error);
    tempSavedRoles.delete(userId); // Revert saved state on error
    await message.channel.send(
      "Failed to update roles. Check bot permissions and role hierarchy."
    );
  }

  return;
}
  // ============================================================
// .fill
// ============================================================

if (message.content.trim() === ".fill") {
  if (!message.guild || !message.member) return;

  // Check if the user has the required permission role
  const REQUIRED_FILL_ROLE_ID = "1555883213233332245";
  if (!message.member.roles.cache.has(REQUIRED_FILL_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }

  // Verify the user has the required role (HITTER_ROLE_ID) or higher
  const requiredRole = message.guild.roles.cache.get(HITTER_ROLE_ID);
  if (!requiredRole) {
    await message.channel.send("Required role for `.fill` not found on this server.");
    return;
  }

  const userHighestPos = findMemberHighestRolePosition(message.member);
  if (userHighestPos < requiredRole.position) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }

  // Determine the range of role positions between user's highest and lowest assigned roles
  const userLowestPos = findMemberLowestRolePosition(message.member);

  if (userHighestPos <= userLowestPos) {
    await message.channel.send("You already have all missing roles in your range.");
    return;
  }

  // Find all unassigned roles that fall strictly between lowest and highest position,
  // excluding managed roles, @everyone, and any IDs in EXCLUDED_ROLE_IDS
  const rolesToAdd = message.guild.roles.cache.filter((role) => {
    return (
      role.position > userLowestPos &&
      role.position < userHighestPos &&
      !message.member.roles.cache.has(role.id) &&
      !role.managed &&
      role.name !== "@everyone" &&
      !EXCLUDED_ROLE_IDS.has(role.id)
    );
  });

  if (rolesToAdd.size === 0) {
    await message.channel.send("You already have all missing roles in your range.");
    return;
  }

  try {
    await message.member.roles.add(rolesToAdd);
    await message.channel.send(
      `Successfully assigned ${rolesToAdd.size} missing role(s) to <@${message.author.id}>.`
    );
  } catch (error) {
    console.error("Failed to execute .fill command:", error);
    await message.channel.send("Failed to assign missing roles. Check bot permissions and role hierarchy.");
  }

  return;
}
    // SICK EMOJI — IMAGE REACTION
if (
  message.channel.id === SICK_EMOJI_CHANNEL_ID &&
  message.attachments.some(attachment =>
    attachment.contentType?.startsWith("image/")
  )
) {
  try {
    await message.react("<a:fire14:1555899431113457735>");
  } catch (error) {
    console.error("Failed to react:", error);
  }
}
    // ============================================================
// AUTO MIDDLEMAN — MESSAGE FLOW
// ============================================================

const autoMmState =
  autoMiddlemanStates.get(
    message.channel.id
  );

if (autoMmState) {

  // ----------------------------------------------------------
  // ADD TRADE PARTNER
  // ----------------------------------------------------------

  if (
    autoMmState.stage === "partner" &&
    message.author.id === autoMmState.creatorId
  ) {
    const raw =
      message.content.trim();

    let partner = null;

    // Mention
    partner =
      message.mentions.users.first() ||
      null;

    // User ID
    if (!partner && /^\d{17,20}$/.test(raw)) {
      try {
        partner =
          await message.client.users.fetch(raw);
      } catch {}
    }

    if (!partner) {
      await message.reply(
        "Please mention the trader or paste their Discord User ID."
      );

      return;
    }

    if (
      partner.id === message.author.id
    ) {
      await message.reply(
        "You cannot add yourself as the trade partner."
      );

      return;
    }

    if (
      partner.bot
    ) {
      await message.reply(
        "Bots cannot be added as trade partners."
      );

      return;
    }

    autoMmState.partnerId =
      partner.id;

    autoMmState.stage =
      "roles";

    await message.channel.permissionOverwrites.edit(
      partner.id,
      {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      }
    );

    await message.channel.send({
      content:
        `<@${partner.id}> has been added to this ticket.`,
      allowedMentions: {
        users: [partner.id],
      },
    });

    const roleMessage =
      await message.channel.send({
        components: [
          buildAutoMmRoleContainer(
            autoMmState
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

    autoMmState.roleMessageId =
      roleMessage.id;

    return;
  }

  // ----------------------------------------------------------
  // DEAL AMOUNT
  // ----------------------------------------------------------

  if (
    autoMmState.stage === "amount"
  ) {
    if (
      message.author.id !==
      autoMmState.senderId
    ) {
      return;
    }

    const value =
      message.content.trim();

    // Numbers only. No $ and no commas.
    if (
      !/^(?:\d+|\d+\.\d{1,2})$/.test(value)
    ) {
      await message.reply(
        "Invalid amount. Use numbers only, for example `50`, `150`, or `1000.00`."
      );

      return;
    }

    const amount =
      Number(value);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      await message.reply(
        "Please enter a valid amount greater than `0`."
      );

      return;
    }

    autoMmState.dealAmount =
      amount.toFixed(2);

    autoMmState.amountConfirmations.clear();

    autoMmState.stage =
      "amount_confirmation";

    await message.channel.send({
      content:
        `<@${autoMmState.senderId}> <@${autoMmState.receiverId}>`,
      allowedMentions: {
        users: [
          autoMmState.senderId,
          autoMmState.receiverId,
        ],
      },
    });

    const confirmation =
      await message.channel.send({
        components: [
          buildAutoMmAmountConfirmation(
            autoMmState
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

    autoMmState.amountConfirmationMessageId =
      confirmation.id;

    return;
  }
}

    // ============================================================
// .receipt
// ============================================================

if (
  message.content.trim() === ".receipt" ||
  message.content.startsWith(".receipt ")
) {
  if (!message.guild || !message.member) return;

  // 1. Check if user has the required role
  const REQUIRED_RECEIPT_ROLE_ID = "1555883213233332245";
  if (!message.member.roles.cache.has(REQUIRED_RECEIPT_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }

  const args = message.content.trim().split(/\s+/);

  // ========================================================
  // .receipt view <id> (Allowed in ANY channel)
  // ========================================================

  if (args[1]?.toLowerCase() === "view") {
    const receiptId = args[2]?.toUpperCase();

    if (!receiptId) {
      await message.channel.send("Usage: `.receipt view <id>`");
      return;
    }

    const receipt = receipts[receiptId];

    if (!receipt) {
      await message.channel.send("Receipt not found.");
      return;
    }

    await message.channel.send({
      components: [buildReceiptContainer(receipt, true)],
      flags: MessageFlags.IsComponentsV2,
    });

    return;
  }

  // ========================================================
  // CREATE RECEIPT (Restricted to Ticket Category)
  // ========================================================

  const TICKET_CATEGORY_ID = "1555883366056984596";
  if (message.channel.parentId !== TICKET_CATEGORY_ID) {
    await message.channel.send("Receipts can only be created inside ticket channels.");
    return;
  }

  if (
    !(await requireStaffLevel(
      message,
      1,
      "manage trade receipts"
    ))
  ) {
    return;
  }

  const mentionedUsers = message.mentions.users;

  if (mentionedUsers.size < 2) {
    await message.channel.send("Usage: `.receipt @buyer @seller <trade>`");
    return;
  }

  const buyer = mentionedUsers.at(0);
  const seller = mentionedUsers.at(1);

  const trade = args.slice(3).join(" ").trim();

  if (!trade) {
    await message.channel.send("Usage: `.receipt @buyer @seller <trade>`");
    return;
  }

  const receiptId = createUniqueReceiptId();

  const receipt = {
    id: receiptId,
    middlemanId: message.author.id,
    buyerId: buyer.id,
    sellerId: seller.id,
    trade,
    timestamp: Date.now(),
  };

  receipts[receiptId] = receipt;
  saveReceipts();

  await message.channel.send({
    components: [buildReceiptContainer(receipt, false)],
    flags: MessageFlags.IsComponentsV2,
  });

  return;
}

if (message.content === ".automiddlemanpanel") {
  if (message.channel.id !== AUTOMIDDLEMAN_CHANNEL_ID) {
    await message.channel.send(
      `This command can only be used in <#${AUTOMIDDLEMAN_CHANNEL_ID}>.`
    );
    return;
  }

  const gifAttachment = new AttachmentBuilder(
    AUTOMIDDLEMAN_GIF_PATH
  );

  const header =
    new TextDisplayBuilder().setContent(
      "## <:Arrow:1555884377282453534> Vanta Central | AutoMiddleman"
    );

  const thumbnail =
  new ThumbnailBuilder()
    .setURL("attachment://vanta_central_thumbnail.gif");

  const headerSection =
    new SectionBuilder()
      .addTextDisplayComponents(header)
      .setThumbnailAccessory(thumbnail);

  const container =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addSectionComponents(
        headerSection
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "**Free, instant and fully automated escrow.**\n" +
          "Pick the currency you are dealing in below and the bot will guide both traders through every step.\n\n" +

          "<:MemberIcon:1555899399354196039> **1.** Choose a currency and press **Start**\n" +
          "<:MapArrow:1555899407155855450> **2.** Set who is sending and who is receiving\n" +
          "<:calendar:1555899422880178176> **3.** Confirm the amount, then send to the generated address\n" +
          "<:whitephonelogominimal:1554231362687344714> **4.** Funds release the moment the trade is completed"
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      )

    // ----------------------------------------------------------
// COINS
// ----------------------------------------------------------

.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
    "### <:Arrow:1555884377282453534> Coins"
  )
)

.addSeparatorComponents(
  new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small)
)

// BTC
.addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "<:btc:1555899312305737820> **BTC** - Bitcoin"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("automiddleman_btc")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    )
)

// ETH
.addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "<:ethereum:1555899320958722048> **ETH** - Ethereum"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("automiddleman_eth")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    )
)

// LTC
.addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "<:ltc:1555899328625774703> **LTC** - Litecoin"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("automiddleman_ltc")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    )
)

// SOL
.addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "<:solana:1555899336515395645> **SOL** - Solana"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("automiddleman_sol")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    )
)


// ----------------------------------------------------------
// STABLECOINS
// ----------------------------------------------------------

.addTextDisplayComponents(
  new TextDisplayBuilder().setContent(
    "### <:Arrow:1555884377282453534> Stablecoins"
  )
)

.addSeparatorComponents(
  new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small)
)

// USDT BSC
.addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "<:usdtbsc:1555899344312467486> **USDT** - BSC (BEP-20)"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("automiddleman_usdt_bsc")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    )
)

// USDT ETH
.addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "<:usdteth:1555899352487305267> **USDT** - Ethereum (ERC20)"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("automiddleman_usdt_eth")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    )
)

// USDT SOL
.addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "<:usdtsol:1555899360796213318> **USDT** - Solana (SOL)"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("automiddleman_usdt_sol")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    )
)

// USDC ETH
.addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "<:usdceth:1555899368924647486> **USDC** - Ethereum (ERC20)"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("automiddleman_usdc_eth")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    )
)

// USDC SOL
.addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "<:usdcsol:1555899376147103785> **USDC** - Solana (SOL)"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("automiddleman_usdc_sol")
        .setLabel("Start")
        .setStyle(ButtonStyle.Primary)
    )
)
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Transaction IDs stay private. Every deal is monitored — bypassing escrow or dealing in DMs results in a permanent ban."
        )
      );

  await message.channel.send({
    files: [gifAttachment],
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  return;
}
// ============================================================
// .howto
// ============================================================

if (
  message.content === ".howto"
) {
  const divider =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  const container =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "## Vanta Central | How To Get Items"
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            ""
          )
      )

      .addSeparatorComponents(
        divider
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "**Steps**\n" +
            "> Find people in trading servers"
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Vanta Central Middleman Service"
          )
      );

  await message.channel.send({
    components: [
      container,
    ],
    flags:
      MessageFlags.IsComponentsV2,
  });

  return;
}

// ============================================================
// .values
// ============================================================

if (
  message.content === ".values"
) {
  // Check if user has the required role
  const REQUIRED_VALUES_ROLE_ID = "1555883213233332245";
  if (!message.member.roles.cache.has(REQUIRED_VALUES_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
  try {
    const valuesChannel =
      await client.channels.fetch(
        VALUES_CHANNEL_ID
      );

    if (
      !valuesChannel ||
      !valuesChannel.isTextBased()
    ) {
      await message.channel.send(
        "The values channel could not be found."
      );
      return;
    }

    const messages =
      await valuesChannel.messages.fetch({
        limit: 1,
      });

    const latestMessage =
      messages.first();

    if (!latestMessage) {
      await message.channel.send(
        "There is no values message to copy."
      );
      return;
    }

    const payload = {
      components:
        latestMessage.components,
      flags:
        MessageFlags.IsComponentsV2,
    };

    if (
      latestMessage.content &&
      latestMessage.content.trim()
    ) {
      payload.content =
        latestMessage.content;
    }

    if (
      latestMessage.attachments.size > 0
    ) {
      payload.files =
        latestMessage.attachments.map(
          (attachment) => ({
            attachment:
              attachment.url,
            name:
              attachment.name,
          })
        );
    }

    await message.channel.send(
      payload
    );

  } catch (error) {
    console.error(
      "Values command error:",
      error
    );

    await message.channel.send(
      "I couldn't copy the latest values message."
    );
  }

  return;
}
// ============================================================
// .fee
// ============================================================

if (
  message.content === ".fee"
) {
  const divider =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  const feeGif =
    new MediaGalleryBuilder()
      .addItems(
        new MediaGalleryItemBuilder()
          .setURL(
            "attachment://vanta_central_thumbnail.gif"
          )
      );

  const feeContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "## Vanta Central | Middleman Service Fee"
          )
      )

      .addMediaGalleryComponents(
        feeGif
      )

      .addSeparatorComponents(
        divider
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "**Thank you for using Vanta Central MM**\n" +
            "> Your items are currently being __held__. To proceed, please make the donation the MM deserves.\n\n" +

            "**Payment**\n" +
            "> Please wait while a **MM** lists a price. Discuss with your trader how you want to pay — split it or one party covers the full fee.\n\n" +

            "-# Once you click a button, you can't redo it."
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addMediaGalleryComponents(
        new MediaGalleryBuilder()
          .addItems(
            new MediaGalleryItemBuilder()
              .setURL(
                "attachment://vanta_central_thumbnail.gif"
              )
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Vanta Central Middleman Service"
          )
      )

      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                "fee_5050"
              )
              .setLabel("50/50")
              .setStyle(
                ButtonStyle.Success
              ),

            new ButtonBuilder()
              .setCustomId(
                "fee_100"
              )
              .setLabel("100%")
              .setStyle(
                ButtonStyle.Primary
              )
          )
      );

  await message.channel.send({
    components: [
      feeContainer,
    ],
    files: [
      AWARENESS_GIF_PATH,
    ],
    flags:
      MessageFlags.IsComponentsV2,
  });

  return;
}
// ============================================================
// .flop
// ============================================================

if (
  message.content.trim() === ".flop" ||
  message.content.startsWith(".flop ")
) {
  if (
    !(await requireStaffLevel(
      message,
      1,
      "flop a user"
    ))
  ) {
    return;
  }

  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.flop @user`"
    );
    return;
  }

  if (targetUser.bot) {
    await message.channel.send(
      "You cannot send a flop to a bot."
    );
    return;
  }

  const notificationContainer =
    new ContainerBuilder()
      .setAccentColor(0x22c55e)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Notification\n\n" +
          "If you're seeing this, you've likely been scammed - but this doesn't end how you think.\n\n" +

          "Most people in this server started out the same way. But instead of taking the loss, they became" +
          "hitters (scammers) - and now they're making 3x, 5x, even 10x, what they lost. This is your chance" +
          "to turn a setback into serious profit.\n\n" +

          "As a hitter, you'll gain access to a system where it's simple - Some of our top hitters make more" +
          "in a week than they ever expected.\n\n" +

          "You now have access to staff chat. Head to <#1555883654541090866> to learn how to get start. Every minute" +
          "you wait is profit missed.\n\n" +

          "Need help getting started? Ask in <#1555883709255913552>. You've already been pulled in - now it's time" +
          "to flip this script and come out ahead."
        )
      );

  await message.channel.send({
    components: [
      notificationContainer,
    ],
    flags: MessageFlags.IsComponentsV2,
  });

  await message.channel.send({
    content: `<@${targetUser.id}>`,
  });

  const decisionContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `<@${targetUser.id}>, do you want to accept this  opportunity to become a hitter?\n\n` +
          `You have **1 minute** to respond.\n` +
          `**The decision is yours. Make it count**`
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addActionRowComponents(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `flop_accept_${targetUser.id}`
              )
              .setLabel("Accept")
              .setStyle(
                ButtonStyle.Success
              ),

            new ButtonBuilder()
              .setCustomId(
                `flop_decline_${targetUser.id}`
              )
              .setLabel("Decline")
              .setStyle(
                ButtonStyle.Danger
              )
          )
      );

  const decisionMessage =
    await message.channel.send({
      components: [
        decisionContainer,
      ],
      flags: MessageFlags.IsComponentsV2,
    });

  setTimeout(async () => {
    try {
      const currentMessage =
        await message.channel.messages.fetch(
          decisionMessage.id
        );

      const alreadyHandled =
        currentMessage.components?.some(
          (component) =>
            component.components?.some(
              (button) =>
                button.customId ===
                  `flop_accept_${targetUser.id}` ||
                button.customId ===
                  `flop_decline_${targetUser.id}`
            )
        ) === false;

      if (alreadyHandled) return;

      const expiredContainer =
        new ContainerBuilder()
          .setAccentColor(0x6b7280)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `<@${targetUser.id}>'s offer has expired.`
            )
          );

      await currentMessage.edit({
        components: [
          expiredContainer,
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.error(
        "Failed to expire flop offer:",
        error
      );
    }
  }, 60 * 1000);

  return;
}

// ============================================================
// .crosstrademm
// ============================================================

if (
  message.content.trim() === ".crosstrademm"
) {
  // Check if user has the required role
  const REQUIRED_CROSSTRADEMM_ROLE_ID = "1555883213233332245";
  if (!message.member.roles.cache.has(REQUIRED_CROSSTRADEMM_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
  const crossTradeGif =
    new AttachmentBuilder(
      "./vanta_central_thumbnail.gif"
    );

  const container =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Vanta Central | Cross-Trade Middleman Info"
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "**1. Middleman Setup**\n" +
          "> The MM uses __one official account__ to handle the entire cross-trade. Both traders must add the MM on this account before the trade begins.\n\n" +

          "**2. Item Collection Process**\n" +
          "> The MM collects items from **Trader A** in the first game, then items from **Trader B** in the second game.\n\n" +

          "**3. Cross-Trade Distribution**\n" +
          "> Once all items are secured, the MM delivers each party's agreed items in their respective games in the __same order__ they were collected.\n\n" +

          "**4. Security & Fairness**\n" +
          "> A single MM account ensures __full transparency, consistency, and reduced risk__ during cross-game transactions.\n\n" +

          "**5. Optional Tip**\n" +
          "> The **final recipient** may optionally tip the MM. Tips are **never required**."
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Both parties must confirm their agreement to this procedure before the cross-trade begins."
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addMediaGalleryComponents(
        new MediaGalleryBuilder()
          .addItems(
            new MediaGalleryItemBuilder()
              .setURL(
                "attachment://vanta_central_thumbnail.gif"
              )
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      );

  await message.channel.send({
    files: [crossTradeGif],
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  return;
}

// ============================================================
// .cashtrademm
// ============================================================

if (
  message.content.trim() === ".cashtrademm"
) {
  // Check if user has the required role
  const REQUIRED_CASHTRADEMM_ROLE_ID = "1555883213233332245";
  if (!message.member.roles.cache.has(REQUIRED_CASHTRADEMM_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
  const mmInfoImage =
    new AttachmentBuilder(
      "./MM_INFO__Seller_Middleman_Buyer.png"
    );

  const container =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Vanta Central | Middleman Info & Explanation"
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "**What is a Middleman (MM)?**\n" +
          "> A __trusted person__ with many vouches who helps transactions go smoothly without scams.\n\n" +

          "**Example: One trader is giving $20 for a Garama**\n" +
          "> The seller gives the MM the Garama on a private server. The MM holds it safely and confirms both sides are ready. The buyer sends $20 directly to the seller. Once payment is confirmed, the MM releases the Garama to the buyer."
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addMediaGalleryComponents(
        new MediaGalleryBuilder()
          .addItems(
            new MediaGalleryItemBuilder()
              .setURL(
                "attachment://MM_INFO__Seller_Middleman_Buyer.png"
              )
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      );

  await message.channel.send({
    files: [mmInfoImage],
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  return;
}
// ============================================================
// .mminfo
// ============================================================

if (message.content.trim() === ".mminfo") {
  // Check if user has the required role
  const REQUIRED_MMINFO_ROLE_ID = "1555883213233332245";
  if (!message.member.roles.cache.has(REQUIRED_MMINFO_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
  const infoContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "## Vanta Central | Middleman Info & Explanation",
            "",
            "> **What is a Middleman (MM)?**",
            "> A __trusted person__ with many vouches who helps transactions go smoothly without scams.",
            "",
            "**Example: One trader is giving $20 for a Garama**",
            "> The seller gives the MM the Garama on a private server. The MM holds it safely and confirms both sides are ready. The buyer sends $20 directly to the seller. Once payment is confirmed, the MM releases the Garama to the buyer.",
          ].join("\n")
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addMediaGalleryComponents(
        new MediaGalleryBuilder()
          .addItems(
            new MediaGalleryItemBuilder()
              .setURL(
                "attachment://MM_INFO__Seller_Middleman_Buyer.png"
              )
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      );

  await message.channel.send({
    files: [
      new AttachmentBuilder(
        "./MM_INFO__Seller_Middleman_Buyer.png"
      ),
    ],
    components: [infoContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  const yesButton =
    new ButtonBuilder()
      .setCustomId("mm_understanding_yes")
      .setLabel("Yes")
      .setStyle(ButtonStyle.Success);

  const noButton =
    new ButtonBuilder()
      .setCustomId("mm_understanding_no")
      .setLabel("No")
      .setStyle(ButtonStyle.Danger);

  const understandingContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "## Vanta Central | Understanding Check",
            "",
            "> **Confirm your understanding of the Middleman process.**",
            "",
            "If you __understand what a Middleman (MM) is__, click **Yes**.",
            "If not, click **No** and let us know how we can assist you.",
          ].join("\n")
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Your response helps us route the ticket correctly."
        )
      )

      .addActionRowComponents(
        new ActionRowBuilder().addComponents(
          yesButton,
          noButton
        )
      );

  await message.channel.send({
    components: [understandingContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  return;
}
// ============================================================
// .timer
// ============================================================

if (
  message.content.trim() === ".timer" ||
  message.content.startsWith(".timer ")
) {

    if (
  !(await requireStaffLevel(
    message,
    1,
    "start escrow timers"
  ))
) {
  return;
}
  const ticketState =
    ticketStates.get(
      message.channel.id
    );

  if (!ticketState) {
    await message.channel.send(
      "This command can only be used inside a ticket."
    );
    return;
  }

  const args =
    message.content.trim().split(/\s+/);

  const duration =
    parseDuration(args[1]);

  if (!duration) {
    await message.channel.send(
      "Usage: `.timer <time>` — examples: `10m`, `30m`, `1h`."
    );
    return;
  }

  clearTicketInactivityTimer(
    message.channel.id
  );

  if (
    ticketState.escrowTimerTimeout
  ) {
    clearTimeout(
      ticketState.escrowTimerTimeout
    );
  }

  const expiresAt =
    Date.now() + duration;



  ticketState.escrowTimerUntil =
    expiresAt;
    ticketState.escrowTimerStartedBy =
  message.author.id;

ticketState.escrowTimerSetBy =
  message.author.id;
     

  const timerContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Escrow Timer Started"
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `> \`・\` **Duration:** ${formatDuration(duration)}`,
            `> \`・\` **Expires:** <t:${Math.floor(expiresAt / 1000)}:R> (<t:${Math.floor(expiresAt / 1000)}:T>)`,
            `> \`・\` **Reason:** Escrow / Holding period`,
            `> \`・\` **Set by:** <@${message.author.id}>`,
            "",
            "*A notification will be sent here automatically when the timer reaches zero.*",
          ].join("\n")
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Escrow Countdown"
        )
      );

  await message.channel.send({
    components: [
      timerContainer,
    ],
    flags:
      MessageFlags.IsComponentsV2,
  });

 const ticketChannel =
  message.channel;

ticketState.escrowTimerTimeout =
  setTimeout(async () => {
      const currentState =
        ticketStates.get(
          message.channel.id
        );

      if (!currentState) {
        return;
      }

     

const startedBy =
  currentState.escrowTimerStartedBy;

const setBy =
  currentState.escrowTimerSetBy;

const expiredContainer =
  new ContainerBuilder()
    .setAccentColor(0xef4444)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          startedBy
            ? `<@${startedBy}> Escrow timer expired!`
            : "Escrow timer expired!",
          "",
          "## Escrow Timer Expired",
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(
          SeparatorSpacingSize.Small
        )
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `> \`・\` **Reason:** Escrow / Holding period`,
          `> \`・\` **Set by:** <@${setBy}>`,
          `> \`・\` **Status:** Time completed`,
          "",
          "*The holding period has elapsed. Please proceed with the trade.*",
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(
          SeparatorSpacingSize.Small
        )
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Vanta Central Escrow System"
      )
    );

await ticketChannel.send({
  components: [
    expiredContainer,
  ],
  flags:
    MessageFlags.IsComponentsV2,
});

 currentState.escrowTimerUntil =
        null;

      currentState.escrowTimerTimeout =
        null;

      startTicketInactivityTimer(
        message.channel
      );
    }, duration);

  return;
}

// ============================================================
// .timers
// ============================================================

if (
  message.content.trim() === ".timers"
) {

    if (
  !(await requireStaffLevel(
    message,
    1,
    "view escrow timers"
  ))
) {
  return;
}
  const ticketState =
    ticketStates.get(
      message.channel.id
    );

  if (!ticketState) {
    await message.channel.send(
      "This command can only be used inside a ticket."
    );
    return;
  }

  const divider =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  let timerText;

if (ticketState.escrowTimerUntil) {
  const remaining =
    ticketState.escrowTimerUntil -
    Date.now();

  ticketState.escrowTimerStartedBy =
  message.author.id;

ticketState.escrowTimerSetBy =
  message.author.id;

    if (remaining > 0) {
      timerText =
        [
          "**Active Escrow Timer**",
          `> \`・\` **Remaining:** ${formatDuration(remaining)}`,
          `> \`・\` **Expires:** <t:${Math.floor(ticketState.escrowTimerUntil / 1000)}:R>`,
          "> `・` **Reason:** Escrow / Holding period",
        ].join("\n");
    } else {
      ticketState.escrowTimerUntil =
        null;

      timerText =
        "> No active escrow timers.";
    }
  } else {
    timerText =
      "> No active escrow timers.";
  }

  const timersContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Active Escrow Timers"
        )
      )

      .addSeparatorComponents(
        divider
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          timerText
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Escrow Management"
        )
      );

  await message.channel.send({
    components: [
      timersContainer,
    ],
    flags:
      MessageFlags.IsComponentsV2,
  });

  return;
}

// ============================================================
// .dm
// ============================================================

if (
  message.content.trim() === ".dm" ||
  message.content.startsWith(".dm ")
) {

    if (
  !(await requireStaffLevel(
    message,
    1,
    "send bot DMs"
  ))
) {
  return;
}
  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.dm @user <message>`"
    );
    return;
  }

  const args =
    message.content.trim().split(/\s+/);

  const dmMessage =
    args.slice(2).join(" ").trim();

  if (!dmMessage) {
    await message.channel.send(
      "Usage: `.dm @user <message>`"
    );
    return;
  }

  try {
    await targetUser.send(
      dmMessage
    );

    await message.channel.send(
      `DM sent to <@${targetUser.id}>.`
    );
  } catch (error) {
    console.error(
      "DM command error:",
      error
    );

    await message.channel.send(
      "I couldn't DM that user. Their DMs may be closed."
    );
  }

  return;
}

    // ============================================================
// .clearwarns
// ============================================================

if (
  message.content.trim() === ".clearwarns" ||
  message.content.startsWith(".clearwarns ")
) {
  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.clearwarns @user`"
    );
    return;
  }

 if (
  !(await requireStaffLevel(
    message,
    3,
    "clear warnings"
  ))
) {
  return;
}

  delete warnings[targetUser.id];

  saveWarnings();

  await message.channel.send(
    `Cleared all warnings for <@${targetUser.id}>`
  );

  return;
}

// ============================================================
// .mute
// ============================================================

if (
  message.content.trim() === ".mute" ||
  message.content.startsWith(".mute ")
) {

  // Check if user has the required role
  const REQUIRED_MUTE_ROLE_ID = "1555883244015321168";
  if (!message.member.roles.cache.has(REQUIRED_MUTE_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
  const args =
    message.content.trim().split(/\s+/);

  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.mute @user <time> <reason>`"
    );
    return;
  }

  const duration =
    parseDuration(args[2]);

  if (!duration) {
    await message.channel.send(
      "Invalid time. Examples: `30s`, `10m`, `2h`, `1d`."
    );
    return;
  }

  const reason =
    args.slice(3).join(" ").trim() ||
    "No reason provided.";

  if (
    duration >
    28 * 24 * 60 * 60 * 1000
  ) {
    await message.channel.send(
      "A Discord timeout cannot be longer than 28 days."
    );
    return;
  }

  try {
    const member =
      await message.guild.members.fetch(
        targetUser.id
      );

    await member.timeout(
      duration,
      reason
    );

    await message.channel.send(
      `Muted <@${targetUser.id}> for ${formatDuration(duration)}.`
    );
  } catch (error) {
    console.error(
      "Mute error:",
      error
    );

    await message.channel.send(
      "I couldn't mute that member."
    );
  }

  return;
}

// ============================================================
// .unmute
// ============================================================

if (
  message.content.trim() === ".unmute" ||
  message.content.startsWith(".unmute ")
) {

    // Check if user has the required role
  const REQUIRED_UNMUTE_ROLE_ID = "1555883244015321168";
  if (!message.member.roles.cache.has(REQUIRED_UNMUTE_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.unmute @user`"
    );
    return;
  }


  try {
    const member =
      await message.guild.members.fetch(
        targetUser.id
      );

    await member.timeout(
      null,
      `Timeout removed by ${message.author.username}`
    );

    await message.channel.send(
      `Unmuted <@${targetUser.id}>.`
    );
  } catch (error) {
    console.error(
      "Unmute error:",
      error
    );

    await message.channel.send(
      "I couldn't remove that user's timeout."
    );
  }

  return;
}

// ============================================================
// .kick
// ============================================================

if (
  message.content.trim() === ".kick" ||
  message.content.startsWith(".kick ")
) {

    // Check if user has the required role
  const REQUIRED_KICK_ROLE_ID = "1555883271907446784";
  if (!message.member.roles.cache.has(REQUIRED_KICK_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
  const args =
    message.content.trim().split(/\s+/);

  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.kick @user <reason>`"
    );
    return;
  }

  const reason =
    args.slice(2).join(" ").trim() ||
    "No reason provided.";


    try{
const member =
  await message.guild.members.fetch(
    targetUser.id
  );

if (
  member.roles.highest.position >=
  message.member.roles.highest.position
) {
  await message.channel.send(
    "You cannot kick a member with an equal or higher role than you."
  );
  return;
}

await member.kick(reason);

    await message.channel.send(
      `Kicked <@${targetUser.id}>.`
    );
  } catch (error) {
    console.error(
      "Kick error:",
      error
    );

    await message.channel.send(
      "I couldn't kick that member."
    );
  }

  return;
}

// ============================================================
// .ban
// ============================================================

if (
  message.content.trim() === ".ban" ||
  message.content.startsWith(".ban ")
) {

  // Check if user has the required role
  const REQUIRED_BAN_ROLE_ID = "1556313435992752320";
  if (!message.member.roles.cache.has(REQUIRED_BAN_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
  const args =
    message.content.trim().split(/\s+/);

  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.ban @user <reason>`"
    );
    return;
  }


  const reason =
    args.slice(2).join(" ").trim() ||
    "No reason provided.";

    
try {
  const targetMember =
    await message.guild.members.fetch(
      targetUser.id
    ).catch(() => null);

  if (
    targetMember &&
    targetMember.roles.highest.position >=
      message.member.roles.highest.position
  ) {
    await message.channel.send(
      "You cannot ban a member with an equal or higher role than you."
    );
    return;
  }

  await message.guild.members.ban(
    targetUser.id,
    {
      reason,
    }
  );

  await message.channel.send(
    `Banned <@${targetUser.id}>.`
  );
  } catch (error) {
    console.error(
      "Ban error:",
      error
    );

    await message.channel.send(
      "I couldn't ban that user."
    );
  }

  return;
}

// ============================================================
// .unban
// ============================================================

if (
  message.content.trim() === ".unban" ||
  message.content.startsWith(".unban ")
) {
   // Check if user has the required role
  const REQUIRED_UNBAN_ROLE_ID = "1556313435992752320";
  if (!message.member.roles.cache.has(REQUIRED_UNBAN_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
  const args =
    message.content.trim().split(/\s+/);

  const userId = args[1];

  if (!userId) {
    await message.channel.send(
      "Usage: `.unban <user_id>`"
    );
    return;
  }

  try {
    await message.guild.members.unban(
      userId,
      `Unbanned by ${message.author.username}`
    );

    await message.channel.send(
      "User unbanned."
    );
  } catch (error) {
    console.error(
      "Unban error:",
      error
    );

    await message.channel.send(
      "I couldn't unban that user."
    );
  }

  return;
}

// ============================================================
// .claim
// ============================================================

if (message.content.trim() === ".claim") {
  const ticketState =
    ticketStates.get(
      message.channel.id
    );

  if (!ticketState) {
    await message.channel.send(
      "This command can only be used inside a ticket."
    );
    return;
  }

if (
  !(await requireStaffLevel(
    message,
    1,
    "claim tickets"
  ))
) {
  return;
}


  if (ticketState.claimerId) {
    await message.channel.send(
      `This ticket is already claimed by <@${ticketState.claimerId}>.`
    );
    return;
  }

  ticketState.claimerId =
    message.author.id;

  await message.channel.permissionOverwrites.edit(
    message.author.id,
    {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
    }
  );

  const claimMessage =
    await message.channel.messages.fetch(
      ticketState.claimMessageId
    );

  await claimMessage.edit({
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            "middleman_unclaim"
          )
          .setLabel("Unclaim")
          .setStyle(
            ButtonStyle.Secondary
          ),

        new ButtonBuilder()
          .setCustomId(
            "middleman_close"
          )
          .setLabel("Close")
          .setStyle(
            ButtonStyle.Danger
          )
      ),
    ],
  });

  await sendChecklistEvent(
    message.channel,
    message.author,
    "Ticket Claimed",
    [
      `> \`・\`**Claimed By**: <@${message.author.id}>`,
      `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
    ],
    0x57f287
  );

  resetTicketInactivityTimer(
    message.channel
  );

  return;
}

// ============================================================
// .unclaim
// ============================================================

if (
  message.content.trim() === ".unclaim"
) {

  const ticketState =
    ticketStates.get(
      message.channel.id
    );

  if (!ticketState) {
    await message.channel.send(
      "This command can only be used inside a ticket."
    );
    return;
  }
if (
  !(await requireStaffLevel(
    message,
    1,
    "unclaim tickets"
  ))
) {
  return;
}

  if (
    ticketState.claimerId !==
    message.author.id
  ) {
    await message.channel.send(
      "Only the current claimer can unclaim this ticket."
    );
    return;
  }

  ticketState.claimerId = null;

  const claimMessage =
    await message.channel.messages.fetch(
      ticketState.claimMessageId
    );

  await claimMessage.edit({
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            "middleman_claim"
          )
          .setLabel("Claim")
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            "middleman_close"
          )
          .setLabel("Close")
          .setStyle(
            ButtonStyle.Danger
          )
      ),
    ],
  });

  await sendChecklistEvent(
    message.channel,
    message.author,
    "Ticket Unclaimed",
    [
      `> \`・\`**Unclaimed By**: <@${message.author.id}>`,
      `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
    ],
    0x8b5cf6
  );

  resetTicketInactivityTimer(
    message.channel
  );

  return;
}

// ============================================================
// .add
// ============================================================

if (
  message.content.trim() === ".add" ||
  message.content.startsWith(".add ")
) {
  const ticketState =
    ticketStates.get(
      message.channel.id
    );

  if (!ticketState) {
    await message.channel.send(
      "This command can only be used inside a ticket."
    );
    return;
  }

  if (
    !(await requireStaffLevel(
      message,
      1,
      "add members to tickets"
    ))
  ) {
    return;
  }

  const args =
    message.content.trim().split(/\s+/);

  let targetUser =
    message.mentions.users.first();

  // If no mention was provided, try a raw user ID
  if (!targetUser && args[1]) {
    targetUser =
      await client.users.fetch(
        args[1]
      ).catch(() => null);
  }

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.add @user` or `.add USER_ID`"
    );
    return;
  }

  await message.channel.permissionOverwrites.edit(
    targetUser.id,
    {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
    }
  );

  await message.channel.send(
    `Added <@${targetUser.id}> to the ticket.`
  );

  resetTicketInactivityTimer(
    message.channel
  );

  return;
}

// ============================================================
// .remove
// ============================================================

if (
  message.content.trim() === ".remove" ||
  message.content.startsWith(".remove ")
) {
  const ticketState =
    ticketStates.get(
      message.channel.id
    );

  if (!ticketState) {
    await message.channel.send(
      "This command can only be used inside a ticket."
    );
    return;
  }
  if (
  !(await requireStaffLevel(
    message,
    1,
    "remove members from tickets"
  ))
) {
  return;
}

  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.remove @user`"
    );
    return;
  }

  if (
    targetUser.id ===
    ticketState.requesterId
  ) {
    await message.channel.send(
      "The ticket requester cannot be removed from their own ticket."
    );
    return;
  }

  await message.channel.permissionOverwrites.delete(
    targetUser.id
  );

  await message.channel.send(
    `Removed <@${targetUser.id}> from the ticket.`
  );

  resetTicketInactivityTimer(
    message.channel
  );

  return;
}

// ============================================================
// .transfer
// ============================================================

if (
  message.content.trim() === ".transfer" ||
  message.content.startsWith(".transfer ")
) {
  const ticketState =
    ticketStates.get(
      message.channel.id
    );

  if (!ticketState) {
    await message.channel.send(
      "This command can only be used inside a ticket."
    );
    return;
  }
  if (
  !(await requireStaffLevel(
    message,
    1,
    "transfer tickets"
  ))
) {
  return;
}

  if (
    ticketState.claimerId !==
    message.author.id
  ) {
    await message.channel.send(
      "Only the current claimer can transfer this ticket."
    );
    return;
  }

  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.transfer @middleman`"
    );
    return;
  }

  const targetMember =
    await message.guild.members.fetch(
      targetUser.id
    );

  if (
    !targetMember.roles.cache.has(
      MIDDLEMAN_ROLE_ID
    )
  ) {
    await message.channel.send(
      "That user is not a middleman."
    );
    return;
  }

  ticketState.claimerId =
    targetUser.id;

  await message.channel.send(
    `<@${targetUser.id}> has been assigned this ticket.`
  );

  await sendChecklistEvent(
    message.channel,
    message.author,
    "Ticket Transferred",
    [
      `> \`・\`**Transferred From**: <@${message.author.id}>`,
      `> \`・\`**Transferred To**: <@${targetUser.id}>`,
      `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
    ],
    0x8b5cf6
  );

  resetTicketInactivityTimer(
    message.channel
  );

  return;
}

// ============================================================
// .hold
// ============================================================

if (message.content.trim() === ".hold") {
  const ticketState =
    ticketStates.get(
      message.channel.id
    );

  if (!ticketState) {
    await message.channel.send(
      "This command can only be used inside a ticket."
    );
    return;
  }
if (
  !(await requireStaffLevel(
    message,
    1,
    "hold tickets"
  ))
) {
  return;
}
  if (
    ticketState.claimerId !==
    message.author.id
  ) {
    await message.channel.send(
      "Only the current claimer can hold this ticket."
    );
    return;
  }

  ticketState.inactivityHeld =
    true;

  clearTicketInactivityTimer(
    message.channel.id
  );

  await message.channel.send(
    "Ticket inactivity timer paused."
  );

  return;
}

// ============================================================
// .unhold
// ============================================================

if (
  message.content.trim() === ".unhold"
) {
  const ticketState =
    ticketStates.get(
      message.channel.id
    );

  if (!ticketState) {
    await message.channel.send(
      "This command can only be used inside a ticket."
    );
    return;
  }
if (
  !(await requireStaffLevel(
    message,
    1,
    "unhold tickets"
  ))
) {
  return;
}
  if (
    ticketState.claimerId !==
    message.author.id
  ) {
    await message.channel.send(
      "Only the current claimer can unhold this ticket."
    );
    return;
  }

  ticketState.inactivityHeld =
    false;

  resetTicketInactivityTimer(
    message.channel
  );

  await message.channel.send(
    "Ticket inactivity timer resumed."
  );

  return;
}

// ============================================================
// .checklist
// ============================================================

if (
  message.content.trim() === ".checklist"
) {
  const ticketState =
    ticketStates.get(
      message.channel.id
    );

  if (!ticketState) {
    await message.channel.send(
      "This command can only be used inside a ticket."
    );
    return;
  }

  if (
  !(await requireStaffLevel(
    message,
    1,
    "update the ticket checklist"
  ))
) {
  return;
}

  await updateChecklistMessage(
    message.channel,
    ticketState
  );

  const originalChecklist =
    await message.channel.messages.fetch(
      ticketState.checklistMessageId
    );

  await message.channel.send({
    content: " ",
    components:
      originalChecklist.components,
  });

  resetTicketInactivityTimer(
    message.channel
  );

  return;
}

  // ============================================================
  // .altcheck
  // ============================================================

  if (
    message.content.trim() === ".altcheck" ||
    message.content.startsWith(".altcheck ")
  ) {

    if (
  !(await requireStaffLevel(
    message,
    1,
    "perform security checks"
  ))
) {
  return;
}
    const targetUser = message.mentions.users.first();

    if (!targetUser) {
      await message.channel.send(
        "Usage: `.altcheck @user`"
      );
      return;
    }

    try {
      const guildMember =
        await message.guild.members.fetch(targetUser.id);

      const createdTimestamp =
        targetUser.createdTimestamp;

      const joinedTimestamp =
        guildMember.joinedTimestamp;

      const now = Date.now();

      const accountAgeDays = Math.floor(
        (now - createdTimestamp) /
          (1000 * 60 * 60 * 24)
      );

      let risk = "Low";

      if (accountAgeDays < 7) {
        risk = "High";
      } else if (accountAgeDays < 30) {
        risk = "Neutral";
      }

      const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);

        return new Intl.DateTimeFormat("en-US", {
          timeZone: "Europe/Amsterdam",
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).format(date);
      };

      const accountCreated = formatTimestamp(
        createdTimestamp
      );

      const joinedServer = joinedTimestamp
        ? formatTimestamp(joinedTimestamp)
        : "Unknown";

      const accountCreatedDiscordTimestamp =
        Math.floor(createdTimestamp / 1000);

      const joinedDiscordTimestamp =
        joinedTimestamp
          ? Math.floor(joinedTimestamp / 1000)
          : null;

      const profileHeader =
        new TextDisplayBuilder().setContent(
          "## User Security Profile"
        );

      const profileAvatar =
        new ThumbnailBuilder().setURL(
          targetUser.displayAvatarURL({
            extension: "png",
            size: 256,
          })
        );

      const profileSection =
        new SectionBuilder()
          .addTextDisplayComponents(
            profileHeader
          )
          .setThumbnailAccessory(
            profileAvatar
          );

      const divider =
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          );

      const joinedDisplay = joinedDiscordTimestamp
        ? `${joinedServer} (<t:${joinedDiscordTimestamp}:R>)`
        : "Unknown";

      const altcheckContainer =
        new ContainerBuilder()
          .setAccentColor(0x8b5cf6)

          .addSectionComponents(
            profileSection
          )

          .addSeparatorComponents(
            divider
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `> \`・\` **User:** <@${targetUser.id}> (\`${targetUser.username}\`)\n` +
              `> \`・\` **User ID:** \`${targetUser.id}\`\n` +
              `> \`・\` **Account Created:** ${accountCreated} (<t:${accountCreatedDiscordTimestamp}:R>)\n` +
              `> \`・\` **Account Age:** \`${accountAgeDays} days\`\n` +
              `> \`・\` **Joined Server:** ${joinedDisplay}\n` +
              `> \`・\` **Risk Assessment:** \`${risk}\``
            )
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "*Account age verification completed.*"
            )
          )

          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(
                SeparatorSpacingSize.Small
              )
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "-# Vanta Central Security Check"
            )
          );

      await message.channel.send({
        components: [altcheckContainer],
        flags: MessageFlags.IsComponentsV2,
      });

    } catch (error) {
      console.error(
        "Altcheck error:",
        error
      );

      await message.channel.send(
        "I couldn't complete the security check for that user."
      );
    }

    return;
  }



  // ============================================================
  // ROBLOX PROFILE INSPECTOR
  // ============================================================

  if (
    message.content.trim() === ".roblox" ||
    message.content.startsWith(".roblox ")
  ) {

    // Check if user has the required role
  const REQUIRED_ROBLOX_ROLE_ID = "1555883166764503120";
  if (!message.member.roles.cache.has(REQUIRED_ROBLOX_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
    const args = message.content.trim().split(/\s+/);
    const username = args[1];

    if (!username) {
      await message.channel.send(
        "Usage: `.roblox <username>`"
      );
      return;
    }

    try {
      const robloxUser = await getRobloxUser(username);

      if (!robloxUser) {
        await message.channel.send(
          `I couldn't find a Roblox user named \`${username}\`.`
        );
        return;
      }

      const userId = robloxUser.id;

      const [
        profile,
        friends,
        avatarUrl,
        presence,
        rolimons,
      ] = await Promise.all([
        getRobloxProfile(userId),
        getRobloxFriends(userId),
        getRobloxAvatar(userId),
        getRobloxPresence(userId),
        getRolimonsPlayer(userId),
      ]);

      // ========================================================
      // CREATED DATE
      // ========================================================

      const createdDate = new Date(profile.created);

      const formattedCreated =
        new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(createdDate);

      // ========================================================
      // ACCOUNT STATUS
      // ========================================================

      let status = "Offline";

      if (presence) {
        if (presence.userPresenceType === 1) {
          status = "Online";
        } else if (presence.userPresenceType === 2) {
          status = "In Game";
        } else if (presence.userPresenceType === 3) {
          status = "In Studio";
        }
      }

      // ========================================================
      // RAP / LIMITED VALUE
      // ========================================================

      const rap =
        rolimons?.rap !== undefined
          ? Number(rolimons.rap).toLocaleString("en-US")
          : "Unavailable";

      const limitedValue =
        rolimons?.value !== undefined
          ? Number(rolimons.value).toLocaleString("en-US")
          : "Unavailable";

      // ========================================================
      // CONTAINER
      // ========================================================

      const divider1 =
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          );

      const profileHeader =
        new TextDisplayBuilder().setContent(
          "-# <:Arrow:1555884377282453534> Roblox Profile & RAP Inspector"
        );

      const profileTitle =
        new TextDisplayBuilder().setContent(
          `## ${profile.displayName} (@${profile.name})`
        );

      const profileSection =
        new SectionBuilder()
          .addTextDisplayComponents(
            profileHeader,
            profileTitle
          );

      if (avatarUrl) {
        profileSection.setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(avatarUrl)
            .setDescription(
              `${profile.name}'s Roblox avatar`
            )
        );
      }

      // ========================================================
      // BUTTONS
      // ========================================================

      const robloxButtons =
        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setLabel("Visit Profile")
            .setStyle(ButtonStyle.Link)
            .setURL(
              `https://www.roblox.com/users/${userId}/profile`
            ),

          new ButtonBuilder()
            .setLabel("Rolimons Inventory")
            .setStyle(ButtonStyle.Link)
            .setURL(
              `https://www.rolimons.com/player/${userId}`
            )
        );

      // ========================================================
      // FINAL CONTAINER
      // ========================================================

      const robloxContainer =
        new ContainerBuilder()
          .setAccentColor(0x8b5cf6)

          .addSectionComponents(
            profileSection
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `> Roblox profile inspection for **${profile.name}**.`
            )
          )

          .addSeparatorComponents(
            divider1
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# USER ID\n` +
              `\`${userId}\`\n\n` +

              `-# CREATED\n` +
              `\`${formattedCreated}\`\n\n` +

              `-# STATUS\n` +
              `\`${status}\`\n\n` +

              `-# RAP / LIMITED\n` +
              `\`${rap} RAP / ${limitedValue} Value\`\n\n` +

              `-# FRIENDS\n` +
              `\`${friends.toLocaleString("en-US")}\``
            )
          )

          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(
                SeparatorSpacingSize.Small
              )
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "-# Vanta Middleman Service  ·  roblox.com"
            )
          )

          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(
                SeparatorSpacingSize.Small
              )
          )

          .addActionRowComponents(
            robloxButtons
          );

      await message.channel.send({
        components: [robloxContainer],
        flags: MessageFlags.IsComponentsV2,
      });

    } catch (error) {
      console.error(
        "Roblox command error:",
        error
      );

      await message.channel.send(
        "Something went wrong while inspecting that Roblox profile."
      );
    }

    return;
  }

  // ============================================================
// .scams
// ============================================================

if (message.content.trim() === ".scams") {
  try {
    const scamsDivider =
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(
          SeparatorSpacingSize.Small
        );

    const scamsAwarenessGif =
      new AttachmentBuilder(
        AWARENESS_GIF_PATH
      ).setName(
        "vanta_central_thumbnail.gif"
      );

    const scamsRulesGif =
      new AttachmentBuilder(
        RULES_GIF_PATH
      ).setName(
        "vanta_central_main.gif"
      );

    const scamsTitle =
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "## Vanta Central | Scam Awareness Guide"
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL(
              "attachment://vanta_central_thumbnail.gif"
            )
            .setDescription(
              "Vanta Central Scam Awareness"
            )
        );

    const scamsText =
      new TextDisplayBuilder().setContent(
        [
          "**Common Scams in Roblox and Discord Communities (2025 Guide)**",
          "> This document outlines the most prevalent scams targeting Roblox players and Discord users.",
          "> Use it to educate community members, moderators, and developers about identifying and preventing fraudulent activity.",
          "",
          "1. **`・` Free Robux and Giveaway Scams**",
          "> **Purpose:** To steal Roblox account credentials or personal information.",
          "> **Description:** Scammers promote \"free Robux,\" \"limiteds,\" or \"headless giveaways\" through messages, Discord servers, or fake websites.",
          "",
          "> **Warning Signs:**",
          "> External links that do not end with \"roblox.com.\"",
          "> Promises of large Robux rewards.",
          "> Urgent or secretive messages.",
          "",
          "2. **`・` Impersonation of Roblox Staff or Developers**",
          "> **Purpose:** To gain trust and extract sensitive information.",
          "> **Description:** Individuals pretend to be Roblox employees, moderators, or official developers.",
          "",
          "> **Warning Signs:**",
          "> Claims of being \"Roblox Support\" or \"QA Tester.\"",
          "> Requests for login, verification, or cookie data.",
          "> Use of staff-like usernames or fake verification badges.",
          "",
          "3. **`・` Limited Item and Robux Trading Scams**",
          "> **Purpose:** To obtain items or currency through deceit.",
          "> **Description:** Scammers propose trading limiteds or Robux outside Roblox's official systems.",
          "",
          "> **Warning Signs:**",
          "> Offers of discounted limiteds or \"cheap headless\" items.",
          "> Use of \"trusted middlemen.\"",
          "> Requests to trade through Discord rather than the Roblox trade system.",
        ].join("\n")
      );

    const scamsGifGallery =
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(
            "attachment://vanta_central_main.gif"
          )
          .setDescription(
            "Vanta Central"
          )
      );

    const scamsContainer =
      new ContainerBuilder()
        .setAccentColor(0x8b5cf6)

        .addSectionComponents(
          scamsTitle
        )

        .addSeparatorComponents(
          scamsDivider
        )

        .addTextDisplayComponents(
          scamsText
        )

        .addSeparatorComponents(
          scamsDivider
        )

        .addMediaGalleryComponents(
          scamsGifGallery
        )

        .addSeparatorComponents(
          scamsDivider
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "-# Vanta Central Middleman Service"
          )
        );

    await message.channel.send({
      components: [scamsContainer],
      files: [
        scamsAwarenessGif,
        scamsRulesGif,
      ],
      flags: MessageFlags.IsComponentsV2,
    });

  } catch (error) {
    console.error(
      "Scams command error:",
      error
    );

    await message.channel.send(
      "I couldn't display the scam awareness guide."
    );
  }

  return;
}
// ============================================================
// .ping
// ============================================================

if (message.content.trim() === ".ping") {
  try {
    const commandUsedAt = new Date();

    const footerTime =
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Amsterdam",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(commandUsedAt);

    const buildPingContainer = (
      messageRoundtrip,
      websocketLatency,
      lastUpdated
    ) => {
      const pingDivider =
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          );

      return new ContainerBuilder()
        .setAccentColor(0x8b5cf6)

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "### Pong!"
          )
        )

        .addSeparatorComponents(
          pingDivider
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              "-# MESSAGE ROUNDTRIP",
              `\`${messageRoundtrip}ms\``,
              "",
              "-# WEBSOCKET LATENCY",
              `\`${websocketLatency}ms\``,
              "",
              "-# LAST UPDATED",
              `<t:${Math.floor(
                lastUpdated.getTime() / 1000
              )}:F>`,
              "",
              "-# Auto-refreshing every 3 seconds",
            ].join("\n")
          )
        )

        .addSeparatorComponents(
          pingDivider
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `-# Vanta Central Middleman service • Today at ${footerTime}`
          )
        );
    };

    // Measure initial message roundtrip.
    const initialStart = Date.now();

    const pingMessage =
      await message.channel.send({
        components: [
          buildPingContainer(
            0,
            client.ws.ping,
            commandUsedAt
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

    const initialRoundtrip =
      Date.now() - initialStart;

    // Show the actual initial measurement.
    await pingMessage.edit({
      components: [
        buildPingContainer(
          initialRoundtrip,
          client.ws.ping,
          commandUsedAt
        ),
      ],
    });

    // Refresh every 3 seconds.
    const pingInterval = setInterval(
      async () => {
        try {
          const updateStart = Date.now();

          const websocketLatency =
            client.ws.ping;

          await pingMessage.edit({
            components: [
              buildPingContainer(
                0,
                websocketLatency,
                new Date()
              ),
            ],
          });

          const messageRoundtrip =
            Date.now() - updateStart;

          await pingMessage.edit({
            components: [
              buildPingContainer(
                messageRoundtrip,
                client.ws.ping,
                new Date()
              ),
            ],
          });

        } catch (error) {
          console.error(
            "Ping refresh error:",
            error
          );

          clearInterval(
            pingInterval
          );
        }
      },
      3000
    );

    // Stop refreshing if the message gets deleted.
    setTimeout(
      () => {
        clearInterval(
          pingInterval
        );
      },
      10 * 60 * 1000
    );

  } catch (error) {
    console.error(
      "Ping command error:",
      error
    );

    await message.channel.send(
      "I couldn't measure the bot latency."
    );
  }

  return;
}



// ============================================================
// .warn
// ============================================================

if (
  message.content.trim() === ".warn" ||
  message.content.startsWith(".warn ")
) {

  // Check if user has the required role
  const REQUIRED_WARN_ROLE_ID = "1555883237614559306";
  if (!message.member.roles.cache.has(REQUIRED_WARN_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }

      if (
    !(await requireStaffLevel(
      message,
      3,
      "warn members"
    ))
  ) {
    return;
  }
  const args =
    message.content.trim().split(/\s+/);

  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.warn @user <reason>`"
    );
    return;
  }

  if (
    targetUser.id ===
    message.author.id
  ) {
    await message.channel.send(
      "You cannot warn yourself."
    );
    return;
  }

  const reason =
    args.slice(2).join(" ").trim();

  if (!reason) {
    await message.channel.send(
      "Usage: `.warn @user <reason>`"
    );
    return;
  }

  try {
    // ========================================================
    // ROLE HIERARCHY CHECK
    // ========================================================

    const targetMember =
      await message.guild.members.fetch(
        targetUser.id
      );

    const authorMember =
      message.member;

    if (!targetMember) {
      await message.channel.send(
        "That user is not a member of this server."
      );
      return;
    }

    if (
      targetMember.roles.highest.position >=
      authorMember.roles.highest.position
    ) {
      await message.channel.send(
        "You cannot warn a member with an equal or higher role than you."
      );
      return;
    }

    // ========================================================
    // CREATE WARNING
    // ========================================================

    removeExpiredWarnings(
      targetUser.id
    );

    if (!warnings[targetUser.id]) {
      warnings[targetUser.id] = [];
    }

    const warningId =
      createUniqueWarningId();

    const warning = {
      id: warningId,
      reason: reason,
      warnedBy: message.author.id,
      timestamp: Date.now(),
    };

    warnings[targetUser.id].push(
      warning
    );

    saveWarnings();

    // ========================================================
    // DM THE WARNED USER
    // ========================================================

    try {
      const warningDm =
        new ContainerBuilder()
          .setAccentColor(0x8b5cf6)

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# <:Arrow:1555884377282453534> You have been warned in Vanta Central™`
            )
          )

          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(
                SeparatorSpacingSize.Small
              )
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                `**Reason:** ${reason}`,
                "",
                `**Warning ID:** \`${warningId}\``,
              ].join("\n")
            )
          )

          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(
                SeparatorSpacingSize.Small
              )
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `-# Moderator: ${message.author.username}`
            )
          );

      await targetUser.send({
        components: [warningDm],
        flags:
          MessageFlags.IsComponentsV2,
      });

    } catch (dmError) {
      console.error(
        `Could not DM ${targetUser.username}:`,
        dmError
      );
    }

    // ========================================================
    // CONFIRMATION
    // ========================================================

    await message.channel.send(
      `Warned <@${targetUser.id}>`
    );

  } catch (error) {
    console.error(
      "Warning error:",
      error
    );

    await message.channel.send(
      "I couldn't issue that warning."
    );
  }

  return;
}
// ============================================================
// .warnings
// ============================================================

if (
  message.content.trim() === ".warnings" ||
  message.content.startsWith(".warnings ")
) {
  // Check if user has the required role
  const REQUIRED_WARNINGS_ROLE_ID = "1555883237614559306";
  if (!message.member.roles.cache.has(REQUIRED_WARNINGS_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }

      if (
    !(await requireStaffLevel(
      message,
      3,
      "view warnings"
    ))
  ) {
    return;
  }
  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.warnings @user`"
    );

    return;
  }

  removeExpiredWarnings(
    targetUser.id
  );

  const userWarnings =
    warnings[targetUser.id] || [];

  const warningsPerPage = 5;

  const totalPages = Math.max(
    1,
    Math.ceil(
      userWarnings.length /
        warningsPerPage
    )
  );

  const currentPage = 1;

  const pageWarnings =
    userWarnings.slice(
      0,
      warningsPerPage
    );

  let warningText =
    "";

  if (pageWarnings.length === 0) {
    warningText =
      "> No active warnings.";
  } else {
    warningText =
      pageWarnings
        .map((warning, index) => {
          const date =
            new Intl.DateTimeFormat(
              "en-US",
              {
                timeZone:
                  "Europe/Amsterdam",
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              }
            ).format(
              new Date(
                warning.timestamp
              )
            );

          return (
            `**${index + 1}.** ` +
            `[ID: \`${warning.id}\`] ${warning.reason}\n` +
            `-# By <@${warning.warnedBy}> on ${date}`
          );
        })
        .join("\n\n");
  }

  const warningsDivider =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  const warningsContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## Warnings for ${targetUser.id}`
        )
      )

      .addSeparatorComponents(
        warningsDivider
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          warningText
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# Page ${currentPage} of ${totalPages} | Warnings expire after 8 days.`
        )
      );

  await message.channel.send({
    components: [
      warningsContainer,
    ],
    flags: MessageFlags.IsComponentsV2,
  });

  return;
}

// ============================================================
// .removewarn
// ============================================================

if (
  message.content.trim() === ".removewarn" ||
  message.content.startsWith(".removewarn ")
) {

      if (
    !(await requireStaffLevel(
      message,
      3,
      "remove warnings"
    ))
  ) {
    return;
  }
  const args =
    message.content.trim().split(/\s+/);

  const targetUser =
    message.mentions.users.first();

  const warningId =
    args[2];

  if (!targetUser || !warningId) {
    await message.channel.send(
      "Usage: `.removewarn @user <warning ID>`"
    );

    return;
  }

  removeExpiredWarnings(
    targetUser.id
  );

  if (!warnings[targetUser.id]) {
    await message.channel.send(
      "Warning not found."
    );

    return;
  }

  const warningIndex =
    warnings[targetUser.id].findIndex(
      (warning) =>
        warning.id === warningId
    );

  if (warningIndex === -1) {
    await message.channel.send(
      "Warning not found."
    );

    return;
  }

warnings[targetUser.id].splice(
  warningIndex,
  1
);

if (
  warnings[targetUser.id].length ===
  0
) {
  delete warnings[targetUser.id];
}

saveWarnings();

await message.channel.send(
  "Warn removed."
);

return;
 
}

    if (message.content.trim() === ".close") {
    const ticketState = ticketStates.get(message.channel.id);

    if (!ticketState) {
      await message.channel.send(
        "This command can only be used inside a ticket."
      );

      return;
    }

    if (
  !(await requireStaffLevel(
    message,
    1,
    "close tickets"
  ))
) {
  return;
}
    if (ticketState.claimerId !== message.author.id) {
      await message.channel.send(
        "Only the current claimer can close this ticket."
      );

      return;
    }
    await message.channel.send(
      "Saving transcript and closing this ticket..."
    );

    await closeTicketChannel(message.channel, {
      type: "Middleman",
      closedBy: message.author,
      reason: "Ticket closed by claimer",
    });

    return;
  }

    // ============================================================
    // .transcript — save a transcript without closing the ticket
    // ============================================================

    if (message.content.trim() === ".transcript") {
      if (!isTicketChannel(message.channel)) {
        await message.channel.send(
          "This command can only be used inside a ticket."
        );
        return;
      }

      if (
        !(await requireStaffLevel(
          message,
          1,
          "save transcripts"
        ))
      ) {
        return;
      }

      const saved = await saveTicketTranscript(
        message.channel,
        null,
        {
          closedBy: message.author,
          reason: "Manual transcript (ticket still open)",
        }
      );

      await message.channel.send(
        saved
          ? `Transcript saved to <#${TICKET_TRANSCRIPT_CHANNEL_ID}>.`
          : "I could not save the transcript. Check the console for the error."
      );

      return;
    }

    if (message.content.startsWith(".vouch ")) {
      // Check if user has the required role
  const REQUIRED_VOUCH_ROLE_ID = "1555883166764503120";
  if (!message.member.roles.cache.has(REQUIRED_VOUCH_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
    const args = message.content.trim().split(/\s+/);

    const targetUser = message.mentions.users.first();
    const rating = Number(args[2]);

    if (!targetUser) {
      await message.channel.send(
        "Usage: `.vouch @user <1-5>`"
      );

      return;
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      await message.channel.send(
        "The rating must be a whole number from 1 to 5."
      );

      return;
    }

    const targetId = targetUser.id;

    if (!vouches[targetId]) {
      vouches[targetId] = [];
    }

    const date = new Date();

    const dateString = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);

    vouches[targetId].push({
      rating,
      fromId: message.author.id,
      date: dateString,
      timestamp: Date.now(),
    });

    saveVouches();

    const userVouches = vouches[targetId];

    const totalVouches = userVouches.length;

    const average =
      userVouches.reduce(
        (sum, vouch) => sum + vouch.rating,
        0
      ) / totalVouches;

    const stars = "⭐".repeat(rating);

    const divider1 = new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small);

    const vouchContainer = new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `-# <:Arrow:1555884377282453534>Vouch submitted for ${targetUser.username}`
        )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## Vouch submitted for ${targetUser.username}`
        )
      )

      .addSeparatorComponents(divider1)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `> ${stars}  (${rating}/5) — thanks for the feedback.\n\n` +
          `-# RATING\n` +
          `\`${rating}/5\`\n\n` +
          `-# NEW AVERAGE\n` +
          `\`${average.toFixed(1)} / 5.0\`\n\n` +
          `-# TOTAL VOUCHES\n` +
          `\`${totalVouches}\`\n\n` +
          `-# FROM\n` +
          `<@${message.author.id}>\n\n` +
          `-# DATE\n` +
          `\`${dateString}\``
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Middleman Service"
        )
      );

    await message.channel.send({
      components: [vouchContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    return;
  }
// ============================================================
// .vouchset
// ============================================================

if (
  message.content === ".vouchset" ||
  message.content.startsWith(".vouchset ")
) {
  const args =
    message.content
      .trim()
      .split(/\s+/);

  const targetUser =
    message.mentions.users.first();

  if (!targetUser) {
    await message.channel.send(
      "Usage: `.vouchset @user <total vouches> <rating>`"
    );
    return;
  }

  const totalVouches =
    Number(args[2]);

  const rating =
    Number(args[3]);

  if (
    !Number.isInteger(totalVouches) ||
    totalVouches < 0
  ) {
    await message.channel.send(
      "The total vouches must be a whole number of 0 or higher."
    );
    return;
  }

  if (
    !Number.isFinite(rating) ||
    rating < 0 ||
    rating > 5
  ) {
    await message.channel.send(
      "The rating must be between 0 and 5."
    );
    return;
  }

  const targetId =
    targetUser.id;

  customVouches[targetId] = {
    totalVouches,
    rating,
  };

  saveCustomVouches();

  const divider =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  const container =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "## Vouches Set"
          )
      )

      .addSeparatorComponents(
        divider
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# USER\n` +
            `<@${targetUser.id}>\n\n` +

            `-# CUSTOM VOUCHES SET\n` +
            `\`${totalVouches}\`\n\n` +

            `-# NEW TOTAL VOUCHES\n` +
            `\`${totalVouches}\`\n\n` +

            `-# AVERAGE RATING\n` +
            `\`${rating.toFixed(1)} / 5.0\``
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Vanta Central Middleman Service"
          )
      );

  await message.channel.send({
    components: [
      container,
    ],
    flags:
      MessageFlags.IsComponentsV2,
  });

  return;
}
// ============================================================
// VOUCH STATS
// ============================================================

if (
  message.content === ".vouchstats" ||
  message.content.startsWith(".vouchstats ")
) {
// Check if user has the required role
  const REQUIRED_VOUCHSET_ROLE_ID = "1555883128843935835";
  if (!message.member.roles.cache.has(REQUIRED_VOUCHSET_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
  try {
    const targetUser =
      message.mentions.users.first() ||
      message.author;

    const targetId = targetUser.id;

    // ----------------------------------------------------------
    // GET STORED STATS
    // ----------------------------------------------------------

    const customData =
      customVouches[targetId];

    const actualVouches =
      vouches[targetId] || [];

    const totalVouches =
      customData
        ? Number(customData.totalVouches) || 0
        : actualVouches.length;

    const averageRating =
      customData
        ? Number(customData.rating) || 0
        : actualVouches.length > 0
          ? actualVouches.reduce(
              (sum, vouch) =>
                sum + Number(vouch.rating || 0),
              0
            ) / actualVouches.length
          : 0;

 // ----------------------------------------------------------
// RECENT ACTIVITY
// ----------------------------------------------------------

let recentActivity = [];

if (message.guild) {
  try {
    await message.guild.members.fetch({
      withPresences: false,
      time: 10000,
    });
  } catch (error) {
    console.error(
      "Could not load guild members for vouchstats:",
      error.code || error.message
    );
  }

  const eligibleMembers =
    message.guild.members.cache.filter(
      (member) =>
        !member.user.bot &&
        member.id !== targetId
    );

  const membersArray =
    [...eligibleMembers.values()];

  for (
    let i = membersArray.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(Math.random() * (i + 1));

    [
      membersArray[i],
      membersArray[j],
    ] = [
      membersArray[j],
      membersArray[i],
    ];
  }

  recentActivity =
    membersArray.slice(0, 3);
}

const roundedStars =
  Math.min(
    5,
    Math.max(
      1,
      Math.round(averageRating)
    )
  );

const today =
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

const recentText =
  recentActivity.length > 0
    ? recentActivity
        .map((member) => {
          return (
            `> ${member.user.username} — ` +
            `${"⭐".repeat(roundedStars)} ` +
            `(${roundedStars}/5)\n` +
            `> *${today}*`
          );
        })
        .join("\n\n")
    : "> No recent activity available.";
    // ----------------------------------------------------------
    // CONTAINER
    // ----------------------------------------------------------

    const divider =
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(
          SeparatorSpacingSize.Small
        );

    const profileHeader =
      new TextDisplayBuilder()
        .setContent(
          `-# <:Arrow:1555884377282453534> ${targetUser.username}'s Vouch Profile`
        );

    const profileAvatar =
      new ThumbnailBuilder()
        .setURL(
          targetUser.displayAvatarURL({
            extension: "png",
            size: 256,
          })
        );

    const profileSection =
      new SectionBuilder()
        .addTextDisplayComponents(
          profileHeader
        )
        .setThumbnailAccessory(
          profileAvatar
        );

    const statsContainer =
      new ContainerBuilder()
        .setAccentColor(0x8b5cf6)

        .addSectionComponents(
          profileSection
        )

        .addSeparatorComponents(
          divider
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              `**<:Arrow:1555884377282453534> Rating**\n` +
              `**${averageRating.toFixed(1)} / 5.0**\n\n` +

              `**<:Arrow:1555884377282453534> Total Vouches**\n` +
              `**${totalVouches}**\n\n` +

              `**<:Arrow:1555884377282453534> Recent Vouches**\n` +
              `${recentText}`
            )
        )
        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(
              SeparatorSpacingSize.Small
            )
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              "-# Vanta Central Middleman Service"
            )
        );

    await message.channel.send({
      components: [statsContainer],
      flags: MessageFlags.IsComponentsV2,
    });

  } catch (error) {
    console.error(
      "Vouchstats error:",
      error
    );

    await message.channel.send(
      "I couldn't load the vouch statistics. Check the bot console for the error."
    );
  }

  return;
}
// ============================================================
// TICKET ACTIVITY TRACKING
// ============================================================

if (
  message.guild &&
  ticketStates.has(message.channel.id)
) {
  resetTicketInactivityTimer(
    message.channel
  );
}
 if (message.content.trim() === ".owners") {
  if (!message.guild || !message.member) return;

  // Check if user has the required role
  const REQUIRED_OWNERS_ROLE_ID = "1555883166764503120";
  if (!message.member.roles.cache.has(REQUIRED_OWNERS_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }

  const divider1 = new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);

  const ownersContainer = new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Bot & Server Owners"
      )
    )

    .addSeparatorComponents(divider1)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          " 1. <@1003512937345986624> (`1003512937345986624`) `(Primary Owner)`",
          " 2. <@1274662183262879828> (`1274662183262879828`) `(Primary Owner)`",
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Vanta Central Middleman Service"
      )
    );

  await message.channel.send({
    components: [ownersContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}
    if (message.content.trim() === ".guide") {

      // Check if user has the required role
  const REQUIRED_GUIDE_ROLE_ID = "1555883166764503120";
  if (!message.member.roles.cache.has(REQUIRED_GUIDE_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }
    const divider1 = new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small);

    const guideGif =
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL("attachment://vanta_central_main.gif")
          .setDescription("Vanta Central Guide")
      );

    const guideButtons =
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("guide_spanish")
          .setLabel("Spanish")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("guide_portuguese_brazil")
          .setLabel("Portuguese (Brazil)")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("guide_portuguese_portugal")
          .setLabel("Portuguese (Portugal)")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("guide_arabic")
          .setLabel("Arabic")
          .setStyle(ButtonStyle.Secondary)
      );

    const guideContainer = new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "```Scam Guide | If you're new to hitting```"
        )
      )

      .addSeparatorComponents(divider1)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "**__What do I do?__**",
            "> `・`You need to go and advertise trades in other servers. Once the other party dms you, you",
            "> should lead the conversation towards using a middleman, Once they agree, you'd send ",
            "> them our server, and create a ticket in <#1555883985580720231> In the ticket you will put your",
            "> username, and the trade that the two of you will complete. Once you create the ticket, a",
            "> **random** middle man will come to assist you.",
            "",
            "**__How do I get profit?__**",
            "> `・` Once you and the middleman complete the trade, you will split the value of the profit",
            "> by 50% between the two of you. However, the middleman gets to decide what to give you",
            "> (as long as it is 50%)",
            "> `・` Keep in mind that the **middleman** decides the split. As long as it is fair then that's what",
            "> goes.",
            "",
            "**__Can I become a middle man?__**",
            "> `・` Once you get 10 hits for us, you can be promoted to a middle man. All proof needs to be",
            "> shown in the activity channel or else promotion won't be granted.",
            "> `・` Once you get 5 ALT hits for us, you can be promoted to a head middle man. All proof",
            "> needs to be shown in the cmds channel or else promotion wont be granted.",
            "> `・` You can promote to higher roles by purchasing or getting alt hits. The pricing and",
            "> promotion amount is listed in <#1555883749416247398>.",
            "",
            "**__Important things to remember?__**",
            "> `・` Check <#1555883929184112692> to ensure that you don’t get demoted or warned for breaking",
            "> them.",
            "> `・` Do not advertise in DMs, and do not have a personal middleman. These offenses will",
            "> result in a ban.",
          ].join("\n")
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addMediaGalleryComponents(guideGif)

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      )

      .addActionRowComponents(guideButtons);

    await message.channel.send({
      components: [guideContainer],
      files: [
        new AttachmentBuilder("./vanta_central_main.gif")
          .setName("vanta_central_main.gif"),
      ],
      flags: MessageFlags.IsComponentsV2,
    });
  }
if (message.content.trim() === ".help") {
  if (!message.guild || !message.member) return;

  // Check if the user has the required role
  const REQUIRED_HELP_ROLE_ID = "1555883166764503120";
  if (!message.member.roles.cache.has(REQUIRED_HELP_ROLE_ID)) {
    await message.channel.send("You do not have permission to use this command.");
    return;
  }

  const divider1 = new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);

  const helpContainer = new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Server Bot Commands"
      )
    )

    .addSeparatorComponents(divider1)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "Here are all the commands you currently have access to:",
          "",
          "<:Arrow:1555884377282453534> **Basic Commands**",
          "`.help` - View available bot commands.",
          "`.owners` - View the list of bot and server owners.",
          "`.guide` - View hitting guide with translation buttons.",
          "`.warnings` - View your own warning history.",
          "`.close` - Close a ticket you are participating in.",
          "`.vouch @user <1-5>` - Submit a review for your middleman.",
          "`.vouchstats [@user]` - View vouch statistics and ratings.",
          "`.roblox <username>` - Inspect Roblox user profile, RAP & limit.",
          "`.altcheck <@user|id>` - Check account age & security risk rating.",
          "`.receipt view <id>` - View verified trade receipt.",
          "`.scams` - View the server's official scam awareness guide.",
          "`.ping` - Check bot latency.",
          "",
          "<:Arrow:1555884377282453534> **Moderation Commands**",
          "`.warn @user <reason>` - Issue a warning to a member.",
          "`.warnings [@user] [page]` - View active warnings for a member.",
          "`.removewarn @user <warnID>` - Remove a specific warning from a member.",
          "`.clearwarns @user` - Clear all active warnings from a member.",
          "`.mute @user <time> <reason>` - Timeout a member (e.g. 10m, 1h, 1d).",
          "`.unmute @user` - Remove timeout from a member.",
          "`.kick @user <reason>` - Kick a member from the server.",
          "`.ban @user <reason>` - Ban a member from the server.",
          "`.unban <user_id>` - Unban a user from the server.",
          "",
          "<:Arrow:1555884377282453534> **Ticket Management**",
          "`.claim` / `.unclaim` - Manage ticket ownership.",
          "`.add @user` / `.remove @user` - Modify ticket access.",
          "`.transfer @user` - Transfer ticket ownership to another MM.",
          "`.hold` / `.unhold` - Pause or resume ticket inactivity timer.",
          "`.checklist` - Post or refresh trade checklist & fee panel.",
          "`.receipt @buyer @seller <trade>` - Generate verified trade receipt.",
          "`.timer <time> [reason]` - Start in-channel escrow timer countdown.",
          "`.timers` - List active escrow timers.",
          "`.dm @user <msg>` - Direct message a user via the bot.",
          "",
          "<:Arrow:1555884377282453534> **Middleman & Panels**",
          "`.mminfo` - MM explanation panel.",
          "`.cashtrademm` / `.crosstrademm` - Trade panels.",
          "`.flop @user` / `.fee` / `.howto` - MM handling panels.",
          "`.values` / - Server panels.",
          "",
          "<:Arrow:1555884377282453534> **Vouch Controls & Alts**",
          "`.vouchset @user <amount> <stars>` - Seed vouches for a user.",
          "`.vouchstats @user` - Check MM vouch statistics.",
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small)
    );

  await message.channel.send({
    components: [helpContainer],
    flags: MessageFlags.IsComponentsV2,
  });
}
});
// ================================
// ALL BUTTON INTERACTIONS
// ================================
async function sendRankInfoMessage(channel) {
  try {
    // Fetch recent messages to see if Rank Info was already posted
    const messages = await channel.messages.fetch({ limit: 50 });
    const alreadySent = messages.some((msg) =>
      msg.content?.includes("Rank Info") ||
      msg.components?.some((comp) =>
        JSON.stringify(comp).includes("Rank Info")
      )
    );

    // If it's already in the channel, do nothing and exit
    if (alreadySent) {
      console.log("Rank Info message already exists. Skipping send.");
      return;
    }

    const rankGif = new AttachmentBuilder(
      "./vanta_central_thumbnail.gif"
    );

    const divider = new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small);

    const rankLines = [
      "<@&1555883213233332245> → 8$",
      "<@&1555883218753028096> → 18$",
      "<@&1555883224595693568> → 28$",
      "<@&1555883231012847709> → 40$",
      "<@&1555883237614559306> → 55$",
      "<@&1555883244015321168> → 72$",
      "<@&1555883249736351794> → 95$",
      "<@&1555883264592584714> → 125$",
      "<@&1555883256740708432> → 155$",
      "<@&1555883271907446784> → 215$",
      "<@&1555883278064418856> → 275$",
      "<@&1555883285937127514> → 365$",
      "<@&1555883292987883543> → 430$",
      "<@&1555883298792808469> → 600$",
      "<@&1555883309400330400> → 840$",
      "**Payment Methods: Crypto, In-game Items**",
      "**DM <@1544755269504860188> or <@1274662183262879828> to buy**",
    ];

    const rankContainer = new ContainerBuilder()
      .setAccentColor(0x8b5cf6)
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("## Rank Info")
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder().setURL(
              "attachment://vanta_central_thumbnail.gif"
            )
          )
      )
      .addSeparatorComponents(divider)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(rankLines.join("\n"))
      )
      .addSeparatorComponents(divider)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      );

    await channel.send({
      files: [rankGif],
      components: [rankContainer],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (error) {
    console.error("Error in sendRankInfoMessage:", error);
  }
}
async function createReportUserTicket(interaction, answers) {
  const guild = interaction.guild;

  const ticketName =
    `report-user-${interaction.user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 90);

  const ticketChannel = await guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: REPORT_USER_CATEGORY_ID,

    permissionOverwrites: [
      {
        id: guild.id,
        deny: ["ViewChannel"],
      },
      {
        id: interaction.user.id,
        allow: [
          "ViewChannel",
          "SendMessages",
          "ReadMessageHistory",
          "AttachFiles",
        ],
      },
      {
        id: REPORT_USER_STAFF_ROLE_ID,
        allow: [
          "ViewChannel",
          "SendMessages",
          "ReadMessageHistory",
          "AttachFiles",
        ],
      },
      {
        id: client.user.id,
        allow: [
          "ViewChannel",
          "SendMessages",
          "ReadMessageHistory",
          "AttachFiles",
          "ManageChannels",
          "ManageMessages",
        ],
      },
    ],
  });

  registerTicketMeta(ticketChannel.id, "Report User", interaction.user.id);

  await ticketChannel.send({
    content:
      `<@&${REPORT_USER_STAFF_ROLE_ID}> <@${interaction.user.id}>`,
    allowedMentions: {
      roles: [REPORT_USER_STAFF_ROLE_ID],
      users: [interaction.user.id],
    },
  });

  const reportContainer =
    new ContainerBuilder()
      .setAccentColor(0xEF4444)

      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder()
              .setContent("## User Report")
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder()
              .setURL("attachment://vanta_central_thumbnail.gif")
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "> A member has been reported. Staff will review the evidence below."
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# <:MemberIcon:1555899399354196039> REPORTED USER\n\`${answers.user}\``
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# CATEGORY\n\`${answers.category}\``
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# REASON & PROOF\n\`${answers.reason}\``
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# REPORTED BY\n<@${interaction.user.id}>`
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Post any additional proof below. Screen recordings are strongly preferred."
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Vanta Central Middleman Service"
          )
      );

  await ticketChannel.send({
    components: [reportContainer],
    files: [
      new AttachmentBuilder(REPORT_USER_GIF_PATH, {
        name: "vanta_central_thumbnail.gif",
      }),
    ],
    flags: MessageFlags.IsComponentsV2,
  });

  const ticketButtons =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("report_user_claim")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("report_user_close")
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger)
      );

  await ticketChannel.send({
    components: [ticketButtons],
  });

  return ticketChannel;
}
async function createMiddlemanApplicationTicket(
  interaction,
  answers
) {
  const guild = interaction.guild;

  const ticketName =
    `mm-application-${interaction.user.username}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 85);

  const ticketChannel = await guild.channels.create({
    name: ticketName,
    type: ChannelType.GuildText,
    parent: MM_APPLICATION_CATEGORY_ID,

    permissionOverwrites: [
      {
        id: guild.id,
        deny: ["ViewChannel"],
      },

      {
        id: interaction.user.id,
        allow: [
          "ViewChannel",
          "SendMessages",
          "ReadMessageHistory",
          "AttachFiles",
        ],
      },

      {
        id: MM_APPLICATION_STAFF_ROLE_ID,
        allow: [
          "ViewChannel",
          "SendMessages",
          "ReadMessageHistory",
          "AttachFiles",
        ],
      },

      {
        id: client.user.id,
        allow: [
          "ViewChannel",
          "SendMessages",
          "ReadMessageHistory",
          "AttachFiles",
          "ManageChannels",
          "ManageMessages",
        ],
      },
    ],
  });

  registerTicketMeta(ticketChannel.id, "Middleman Application", interaction.user.id);

  // ----------------------------------------------------------
  // TAG STAFF ROLE + APPLICANT
  // ----------------------------------------------------------

  await ticketChannel.send({
    content:
      `<@&${MM_APPLICATION_STAFF_ROLE_ID}> <@${interaction.user.id}>`,
    allowedMentions: {
      roles: [MM_APPLICATION_STAFF_ROLE_ID],
      users: [interaction.user.id],
    },
  });

  // ----------------------------------------------------------
  // APPLICATION CONTAINER
  // ----------------------------------------------------------

  const applicationContainer =
    new ContainerBuilder()
      .setAccentColor(0x8B5CF6)

      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder()
              .setContent(
                "## Middleman Application"
              )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder()
              .setURL(
                "attachment://vanta_central_thumbnail.gif"
              )
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "> A new **Middleman application** has been submitted. Staff will review it shortly."
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# <:MemberIcon:1555899399354196039> APPLICANT\n<@${interaction.user.id}>`
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# VOUCHES\n\`${answers.vouches}\``
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# EXPERIENCE\n\`${answers.experience}\``
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# COLLATERAL\n\`${answers.collateral}\``
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# <:CALENDAR:1555899422880178176> AVAILABILITY\n\`${answers.availability}\``
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Post your screen-recorded proof of vouches and collateral below. Screenshots are not accepted."
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Vanta Central Middleman Service"
          )
      );

  await ticketChannel.send({
    components: [applicationContainer],

    files: [
      new AttachmentBuilder(
        "./vanta_central_thumbnail.gif",
        {
          name: "vanta_central_thumbnail.gif",
        }
      ),
    ],

    flags: MessageFlags.IsComponentsV2,
  });

  // ----------------------------------------------------------
  // CLAIM + CLOSE BUTTONS
  // ----------------------------------------------------------

  const ticketButtons =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("mm_application_claim")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("mm_application_close")
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger)
      );

  await ticketChannel.send({
    components: [ticketButtons],
  });

  return ticketChannel;
}
function loadSupportInfoState() {
  return loadJsonFile(SUPPORT_INFO_STATE_FILE, { posted: false });
}

function saveSupportInfoState(data) {
  saveJsonFile(SUPPORT_INFO_STATE_FILE, data);
}
async function sendSupportInfoOnce() {
  try {
    const state = loadSupportInfoState();

    if (state.posted) {
      console.log(
        "[SUPPORT INFO] Message already exists. Skipping."
      );
      return;
    }

    const channel =
      await client.channels.fetch(SUPPORT_INFO_CHANNEL_ID);

    if (!channel || !channel.isTextBased()) {
      console.error(
        "[SUPPORT INFO] Channel not found or is not text-based."
      );
      return;
    }

    const container =
      new ContainerBuilder()
        .setAccentColor(0x8B5CF6)

        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder()
                .setContent(
                  "## Vanta Central | Support & Scam Reporting"
                )
            )
            .setThumbnailAccessory(
              new ThumbnailBuilder()
                .setURL(
                  "attachment://vanta_central_thumbnail.gif"
                )
            )
        )

        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
`To maintain a safe, secure, and trusted trading environment, Vanta Central operates an official Support & Scam Reporting System for members participating in trades.

━━━━━━━━━━━━━━━━━━

# Purpose of Support Tickets
The support system is strictly used for:
• **Staff Applications**
• **General Assistance**
• **Official Scam Reports**
• **Compensation Requests**

All reports must be related to trades conducted within the server.

━━━━━━━━━━━━━━━━━━

# Official MM Scam Reports Only
Compensation requests are only eligible if the trade was completed:
> • **Inside this Discord server**
> • Through an **official trade empire Middleman**
> • Under the **MM Accountability Policy**

Trades completed outside the server or without an official MM are not covered.

━━━━━━━━━━━━━━━━━━

# Evidence Requirement
All scam or refund reports must include:
• **Clear screenshots**
• **Video proof if requested**
• **Valid transaction evidence**
• **Complete trade context**

Insufficient, edited, or fabricated evidence will result in an immediate denial.

━━━━━━━━━━━━━━━━━━

# Report Timeframe
Scam and compensation reports must be submitted within the timeframe stated in the:
> **MM Accountability Policy**

Late reports may not be reviewed by staff.

━━━━━━━━━━━━━━━━━━

# False Reports & Abuse
Submitting false claims, fake evidence, or abusing the compensation system may result in:
• **Permanent Blacklist**
• **Server Ban**
• **Additional Moderation Action**

━━━━━━━━━━━━━━━━━━

# Staff Applications
Applicants must provide:
• **Truthful information**
• **Accurate application responses**
• **Proper identification if requested**

Dishonesty, impersonation, or misleading information may result in denial or punishment.

━━━━━━━━━━━━━━━━━━

# One Ticket Per Issue
Please do not open multiple tickets regarding the same matter.
> Duplicate tickets may be closed and can result in penalties.

━━━━━━━━━━━━━━━━━━

# Respect Staff Members
Harassment, excessive pinging, spamming, or pressuring staff members will not be tolerated.
> Violations may lead to **ticket closure** or moderation action.

━━━━━━━━━━━━━━━━━━

# Final Decisions
All support, compensation, application, and moderation decisions are handled at staff discretion.
> **Staff & Executive decisions are final.**`
            )
        )

        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
        )

        .addMediaGalleryComponents(
          new MediaGalleryBuilder()
            .addItems(
              new MediaGalleryItemBuilder()
                .setURL(
                  "attachment://vanta_central_main.gif"
                )
            )
        )

        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(SeparatorSpacingSize.Small)
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              "-# Vanta Central Middleman Service"
            )
        );

    const message =
      await channel.send({
        components: [container],
        files: [
          new AttachmentBuilder(
            SUPPORT_INFO_GIF_PATH,
            {
              name: "vanta_central_thumbnail.gif",
            }
          ),
          new AttachmentBuilder(
            SUPPORT_INFO_BOTTOM_GIF_PATH,
            {
              name: "vanta_central_main.gif",
            }
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

    saveSupportInfoState({
      posted: true,
      messageId: message.id,
      postedAt: Date.now(),
    });

    console.log(
      "[SUPPORT INFO] Message posted successfully."
    );
  } catch (error) {
    console.error(
      "[SUPPORT INFO] Error:",
      error
    );
  }
}
// ============================================================
// TICKET TRANSCRIPTS
// ============================================================
//
// Every ticket type goes through closeTicketChannel(), which:
//   1. saves a transcript (HTML + plain text) to the transcript channel
//   2. clears all in-memory state / timers for the ticket
//   3. deletes the channel
//
// You can also save a transcript without closing using `.transcript`.

const TICKET_META_FILE = "./ticketMeta.json";

// If true, the ticket opener also gets the transcript by DM when it closes.
const DM_TRANSCRIPT_TO_OPENER = false;

// Embedded image limits (Discord CDN links expire, so small images are
// stored inside the HTML file itself).
const TRANSCRIPT_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const TRANSCRIPT_MAX_EMBED_TOTAL_BYTES = 8 * 1024 * 1024;

// ------------------------------------------------------------
// Ticket metadata (type + opener). Saved to disk so transcripts keep
// the right type even after the bot restarts.
// ------------------------------------------------------------

let ticketMeta = loadJsonFile(TICKET_META_FILE, {});

function saveTicketMeta() {
  try {
    saveJsonFile(TICKET_META_FILE, ticketMeta);
  } catch (error) {
    console.error("[TRANSCRIPT] Could not save ticket metadata:", error);
  }
}

function registerTicketMeta(channelId, type, openerId = null) {
  ticketMeta[channelId] = { type, openerId, openedAt: Date.now() };
  saveTicketMeta();
}

// ------------------------------------------------------------
// Text helpers
// ------------------------------------------------------------

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function describeOpener(meta) {
  if (!meta?.openerId) return null;

  const user = client.users.cache.get(meta.openerId);
  return user ? `${user.tag} (${user.id})` : meta.openerId;
}

function formatTranscriptTime(date) {
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

// Replaces <@id>, <@&id> and <#id> with readable names.
function resolveMentions(text, message) {
  const guild = message.guild;

  return String(text ?? "")
    .replace(/<@!?(\d+)>/g, (_, id) => {
      const user = message.mentions?.users?.get(id) || client.users.cache.get(id);
      const member = guild?.members?.cache?.get(id);
      return `@${member?.displayName || user?.username || id}`;
    })
    .replace(/<@&(\d+)>/g, (_, id) => {
      const role = guild?.roles?.cache?.get(id);
      return `@${role?.name || "role"}`;
    })
    .replace(/<#(\d+)>/g, (_, id) => {
      const target = guild?.channels?.cache?.get(id);
      return `#${target?.name || "channel"}`;
    });
}

// Pulls readable text out of Components V2 messages (containers, sections,
// text displays, media galleries, buttons). Works on both component classes
// and raw JSON because it only uses property access.
function collectComponentContent(component, out) {
  if (!component) return;

  if (typeof component.content === "string" && component.content.trim()) {
    out.text.push(component.content);
  }

  const mediaUrl = component.media?.url || component.file?.url;
  if (mediaUrl) out.media.push(mediaUrl);

  if (Array.isArray(component.items)) {
    for (const item of component.items) {
      const url = item?.media?.url;
      if (url) out.media.push(url);
    }
  }

  if (component.label && (component.customId || component.custom_id || component.url)) {
    out.buttons.push(component.label);
  }

  if (component.accessory) collectComponentContent(component.accessory, out);

  if (Array.isArray(component.components)) {
    for (const child of component.components) collectComponentContent(child, out);
  }
}

function extractMessageContent(message) {
  const out = { text: [], media: [], buttons: [] };

  for (const row of message.components || []) {
    collectComponentContent(row, out);
  }

  return out;
}

// ------------------------------------------------------------
// Fetching
// ------------------------------------------------------------

async function fetchAllTicketMessages(channel) {
  const all = [];
  let before = null;

  while (true) {
    const batch = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    });

    if (batch.size === 0) break;

    all.push(...batch.values());
    before = batch.last().id;

    if (batch.size < 100) break;
  }

  return all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

// Downloads small images so they survive after Discord's CDN links expire.
async function embedImagesForTranscript(messages) {
  const embedded = new Map();
  let totalBytes = 0;

  for (const message of messages) {
    for (const attachment of message.attachments.values()) {
      const isImage = (attachment.contentType || "").startsWith("image/");
      if (!isImage || attachment.size > TRANSCRIPT_MAX_IMAGE_BYTES) continue;
      if (totalBytes + attachment.size > TRANSCRIPT_MAX_EMBED_TOTAL_BYTES) continue;

      try {
        const response = await fetch(attachment.url);
        if (!response.ok) continue;

        const buffer = Buffer.from(await response.arrayBuffer());
        totalBytes += buffer.length;

        embedded.set(
          attachment.id,
          `data:${attachment.contentType};base64,${buffer.toString("base64")}`
        );
      } catch {
        // Falls back to the normal link.
      }
    }
  }

  return embedded;
}

// ------------------------------------------------------------
// Markdown -> HTML (the subset Discord messages actually use)
// ------------------------------------------------------------

function renderInlineMarkdown(escaped) {
  return escaped
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<u>$1</u>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdownToHtml(text) {
  const parts = String(text).split(/```/);
  let html = "";

  parts.forEach((part, index) => {
    // Odd indexes are inside a code fence.
    if (index % 2 === 1) {
      const body = part.replace(/^[a-zA-Z0-9_-]*\n/, "");
      html += `<pre>${escapeHtml(body.replace(/\n$/, ""))}</pre>`;
      return;
    }

    for (const rawLine of part.split("\n")) {
      const line = escapeHtml(rawLine);

      if (/^&gt; /.test(line)) {
        html += `<div class="quote">${renderInlineMarkdown(line.slice(5))}</div>`;
      } else if (/^### /.test(line)) {
        html += `<div class="h3">${renderInlineMarkdown(line.slice(4))}</div>`;
      } else if (/^## /.test(line)) {
        html += `<div class="h2">${renderInlineMarkdown(line.slice(3))}</div>`;
      } else if (/^# /.test(line)) {
        html += `<div class="h1">${renderInlineMarkdown(line.slice(2))}</div>`;
      } else if (/^-# /.test(line)) {
        html += `<div class="sub">${renderInlineMarkdown(line.slice(3))}</div>`;
      } else if (line.trim() === "") {
        html += "<br>";
      } else {
        html += `<div>${renderInlineMarkdown(line)}</div>`;
      }
    }
  });

  return html;
}

// ------------------------------------------------------------
// Transcript builders
// ------------------------------------------------------------

function describeMessage(message) {
  const v2 = extractMessageContent(message);
  const content = resolveMentions(message.content, message);

  const embeds = message.embeds.map((embed) => ({
    title: embed.title || "",
    description: resolveMentions(embed.description || "", message),
    fields: (embed.fields || []).map((f) => ({
      name: f.name,
      value: resolveMentions(f.value, message),
    })),
    url: embed.url || "",
  }));

  return {
    content,
    v2Text: v2.text.map((t) => resolveMentions(t, message)),
    v2Media: v2.media,
    v2Buttons: v2.buttons,
    embeds,
    attachments: [...message.attachments.values()],
  };
}

function buildTranscriptText({ channel, ticketType, messages, meta, closedBy, reason }) {
  const lines = [];
  const bar = "=".repeat(50);

  lines.push(bar, "VANTA CENTRAL — TICKET TRANSCRIPT", bar);
  lines.push(`Ticket: ${channel.name}`);
  lines.push(`Type: ${ticketType}`);
  lines.push(`Channel ID: ${channel.id}`);
  if (meta?.openerId) lines.push(`Opened by: ${describeOpener(meta)}`);
  lines.push(`Created: ${channel.createdAt.toISOString()}`);
  lines.push(`Closed: ${new Date().toISOString()}`);
  lines.push(`Closed by: ${closedBy ? `${closedBy.tag} (${closedBy.id})` : "System"}`);
  if (reason) lines.push(`Reason: ${reason}`);
  lines.push(`Messages: ${messages.length}`);
  lines.push(bar, "");

  for (const message of messages) {
    const info = describeMessage(message);

    lines.push(
      `[${formatTranscriptTime(message.createdAt)}] ${message.author.tag} (${message.author.id})${
        message.author.bot ? " [BOT]" : ""
      }`
    );

    if (info.content) lines.push(info.content);
    for (const text of info.v2Text) lines.push(text);
    for (const url of info.v2Media) lines.push(`[Media] ${url}`);
    if (info.v2Buttons.length) lines.push(`[Buttons] ${info.v2Buttons.join(" | ")}`);

    for (const embed of info.embeds) {
      if (embed.title) lines.push(`[Embed] ${embed.title}`);
      if (embed.description) lines.push(embed.description);
      for (const field of embed.fields) lines.push(`${field.name}: ${field.value}`);
      if (embed.url) lines.push(`[Embed URL] ${embed.url}`);
    }

    for (const attachment of info.attachments) {
      lines.push(`[Attachment] ${attachment.name} — ${attachment.url}`);
    }

    lines.push("");
  }

  if (messages.length === 0) lines.push("[No messages found in this ticket.]");

  return lines.join("\n");
}

function buildTranscriptHtml({
  channel,
  ticketType,
  messages,
  meta,
  closedBy,
  reason,
  embeddedImages,
}) {
  const participants = new Map();
  for (const message of messages) {
    const entry = participants.get(message.author.id) || {
      tag: message.author.tag,
      count: 0,
    };
    entry.count += 1;
    participants.set(message.author.id, entry);
  }

  const participantList = [...participants.values()]
    .sort((a, b) => b.count - a.count)
    .map((p) => `${escapeHtml(p.tag)} (${p.count})`)
    .join(", ");

  const rows = messages
    .map((message) => {
      const info = describeMessage(message);
      const avatar = message.author.displayAvatarURL({ extension: "png", size: 64 });
      const name =
        message.member?.displayName || message.author.globalName || message.author.username;

      let body = "";

      if (info.content) body += `<div class="text">${renderMarkdownToHtml(info.content)}</div>`;

      for (const text of info.v2Text) {
        body += `<div class="text card">${renderMarkdownToHtml(text)}</div>`;
      }

      for (const url of info.v2Media) {
        body += `<div class="att"><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></div>`;
      }

      if (info.v2Buttons.length) {
        body += `<div class="buttons">${info.v2Buttons
          .map((label) => `<span class="btn">${escapeHtml(label)}</span>`)
          .join("")}</div>`;
      }

      for (const embed of info.embeds) {
        body += `<div class="embed">`;
        if (embed.title) body += `<div class="h2">${escapeHtml(embed.title)}</div>`;
        if (embed.description) body += renderMarkdownToHtml(embed.description);
        for (const field of embed.fields) {
          body += `<div class="field"><strong>${escapeHtml(field.name)}</strong><br>${renderMarkdownToHtml(field.value)}</div>`;
        }
        body += `</div>`;
      }

      for (const attachment of info.attachments) {
        const embedded = embeddedImages.get(attachment.id);

        if (embedded) {
          body += `<div class="att"><img src="${embedded}" alt="${escapeHtml(attachment.name)}"></div>`;
        } else {
          body += `<div class="att">📎 <a href="${escapeHtml(attachment.url)}" target="_blank" rel="noreferrer">${escapeHtml(attachment.name)}</a></div>`;
        }
      }

      if (!body) body = `<div class="text muted">(no readable content)</div>`;

      return `<div class="msg">
  <img class="avatar" src="${escapeHtml(avatar)}" alt="">
  <div class="main">
    <div class="head"><span class="name">${escapeHtml(name)}</span>${
      message.author.bot ? '<span class="bot">BOT</span>' : ""
    }<span class="time">${escapeHtml(formatTranscriptTime(message.createdAt))}</span></div>
    ${body}
  </div>
</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transcript — ${escapeHtml(channel.name)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #313338; color: #dbdee1; font: 15px/1.45 "Segoe UI", Helvetica, Arial, sans-serif; }
  .wrap { max-width: 900px; margin: 0 auto; padding: 24px 16px 64px; }
  .info { background: #2b2d31; border-left: 4px solid #8b5cf6; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px; }
  .info h1 { margin: 0 0 8px; font-size: 20px; color: #fff; }
  .info div { color: #b5bac1; font-size: 13px; margin-top: 2px; }
  .info strong { color: #dbdee1; }
  .msg { display: flex; gap: 14px; padding: 6px 0; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; flex: none; background: #1e1f22; }
  .main { min-width: 0; flex: 1; }
  .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .name { font-weight: 600; color: #fff; }
  .bot { background: #5865f2; color: #fff; font-size: 10px; padding: 1px 5px; border-radius: 4px; }
  .time { color: #949ba4; font-size: 12px; }
  .text { word-wrap: break-word; overflow-wrap: anywhere; }
  .text.card { background: #2b2d31; border-radius: 6px; padding: 8px 12px; margin-top: 4px; border-left: 3px solid #4e5058; }
  .muted { color: #949ba4; font-style: italic; }
  .quote { border-left: 3px solid #4e5058; padding-left: 10px; margin: 2px 0; }
  .h1 { font-size: 22px; font-weight: 700; } .h2 { font-size: 18px; font-weight: 700; } .h3 { font-size: 16px; font-weight: 700; }
  .sub { font-size: 12px; color: #949ba4; }
  code { background: #1e1f22; padding: 1px 4px; border-radius: 4px; font-family: Consolas, monospace; font-size: 13px; }
  pre { background: #1e1f22; padding: 8px 10px; border-radius: 6px; overflow-x: auto; margin: 4px 0; font-family: Consolas, monospace; font-size: 13px; }
  a { color: #00a8fc; text-decoration: none; } a:hover { text-decoration: underline; }
  .embed { background: #2b2d31; border-left: 4px solid #4e5058; border-radius: 4px; padding: 8px 12px; margin-top: 4px; }
  .field { margin-top: 6px; }
  .att { margin-top: 4px; } .att img { max-width: 420px; max-height: 320px; border-radius: 6px; }
  .buttons { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
  .btn { background: #4e5058; color: #fff; padding: 3px 10px; border-radius: 4px; font-size: 13px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="info">
    <h1>${escapeHtml(channel.name)}</h1>
    <div><strong>Type:</strong> ${escapeHtml(ticketType)}</div>
    ${meta?.openerId ? `<div><strong>Opened by:</strong> ${escapeHtml(describeOpener(meta))}</div>` : ""}
    <div><strong>Created:</strong> ${escapeHtml(formatTranscriptTime(channel.createdAt))}</div>
    <div><strong>Closed:</strong> ${escapeHtml(formatTranscriptTime(new Date()))}</div>
    <div><strong>Closed by:</strong> ${escapeHtml(closedBy ? closedBy.tag : "System")}</div>
    ${reason ? `<div><strong>Reason:</strong> ${escapeHtml(reason)}</div>` : ""}
    <div><strong>Messages:</strong> ${messages.length}</div>
    <div><strong>Participants:</strong> ${participantList || "none"}</div>
    <div><strong>Channel ID:</strong> ${escapeHtml(channel.id)}</div>
  </div>
${rows || '<div class="muted">No messages found in this ticket.</div>'}
</div>
</body>
</html>`;
}

// ------------------------------------------------------------
// Saving
// ------------------------------------------------------------

async function saveTicketTranscript(
  channel,
  ticketType = null,
  { closedBy = null, reason = null } = {}
) {
  try {
    const transcriptChannel = await client.channels.fetch(TICKET_TRANSCRIPT_CHANNEL_ID);

    if (!transcriptChannel || !transcriptChannel.isTextBased()) {
      console.error(
        `[TRANSCRIPT] Transcript channel ${TICKET_TRANSCRIPT_CHANNEL_ID} could not be found.`
      );
      return false;
    }

    const meta = ticketMeta[channel.id] || null;
    const type = ticketType || meta?.type || "Unknown Ticket";
    const messages = await fetchAllTicketMessages(channel);
    const embeddedImages = await embedImagesForTranscript(messages);

    const details = { channel, ticketType: type, messages, meta, closedBy, reason };

    const html = buildTranscriptHtml({ ...details, embeddedImages });
    const text = buildTranscriptText(details);

    const safeName = channel.name.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80);

    // Attachments are consumed when sent, so build a fresh set each time.
    const makeFiles = () => [
      new AttachmentBuilder(Buffer.from(html, "utf8"), {
        name: `${safeName}-transcript.html`,
      }),
      new AttachmentBuilder(Buffer.from(text, "utf8"), {
        name: `${safeName}-transcript.txt`,
      }),
    ];

    const summary = [
      "## Ticket Transcript",
      `**Ticket:** \`${channel.name}\``,
      `**Type:** \`${type}\``,
      meta?.openerId ? `**Opened by:** <@${meta.openerId}>` : null,
      `**Closed by:** ${closedBy ? `<@${closedBy.id}>` : "`System`"}`,
      reason ? `**Reason:** ${reason}` : null,
      `**Messages:** \`${messages.length}\``,
      `**Channel ID:** \`${channel.id}\``,
      "-# Open the .html file in a browser for the full view.",
    ]
      .filter(Boolean)
      .join("\n");

    await transcriptChannel.send({
      content: summary,
      files: makeFiles(),
      allowedMentions: { parse: [] },
    });

    if (DM_TRANSCRIPT_TO_OPENER && meta?.openerId) {
      try {
        const opener = await client.users.fetch(meta.openerId);
        await opener.send({
          content: `Here is the transcript of your ticket \`${channel.name}\`.`,
          files: makeFiles(),
        });
      } catch {
        // Opener has DMs closed — ignore.
      }
    }

    console.log(`[TRANSCRIPT] Saved ${channel.name} (${type}, ${messages.length} messages)`);
    return true;
  } catch (error) {
    console.error(`[TRANSCRIPT] Failed to save ${channel?.name || "unknown ticket"}:`, error);
    return false;
  }
}

function isTicketChannel(channel) {
  return Boolean(
    ticketMeta[channel.id] ||
      ticketStates.has(channel.id) ||
      autoMiddlemanStates.has(channel.id) ||
      [
        MM_TICKET_CATEGORY_ID,
        MM_APPLICATION_CATEGORY_ID,
        SUPPORT_TICKET_CATEGORY_ID,
        REPORT_USER_CATEGORY_ID,
      ].includes(channel.parentId)
  );
}

// ------------------------------------------------------------
// One close path for every ticket type
// ------------------------------------------------------------

async function closeTicketChannel(
  channel,
  { type = null, closedBy = null, reason = "Ticket closed" } = {}
) {
  // Stop timers first so nothing fires while we are saving.
  clearTicketInactivityTimer(channel.id);

  const state = ticketStates.get(channel.id);
  if (state?.escrowTimerTimeout) clearTimeout(state.escrowTimerTimeout);

  // One retry: a transcript is the only record once the channel is gone.
  let saved = await saveTicketTranscript(channel, type, { closedBy, reason });
  if (!saved) saved = await saveTicketTranscript(channel, type, { closedBy, reason });

  if (!saved) {
    console.error(
      `[TRANSCRIPT] No transcript saved for ${channel.name} — deleting the channel anyway.`
    );
  }

  ticketStates.delete(channel.id);
  autoMiddlemanStates.delete(channel.id);
  supportTicketClaims.delete(channel.id);
  reportUserClaims.delete(channel.id);
  middlemanApplicationClaims.delete(channel.id);

  if (ticketMeta[channel.id]) {
    delete ticketMeta[channel.id];
    saveTicketMeta();
  }

  await channel.delete(reason).catch((error) => {
    console.error(`[TICKET] Failed to delete ${channel.name}:`, error);
  });

  return saved;
}

const middlemanApplicationClaims = new Map();
client.on("interactionCreate", async (interaction) => {

  if (
  interaction.isButton() &&
  interaction.customId === "support_ticket_claim"
) {
  const member =
    await interaction.guild.members.fetch(interaction.user.id);

  if (!member.roles.cache.has(SUPPORT_TICKET_STAFF_ROLE_ID)) {
    return interaction.reply({
      content: "Only Middleman staff can claim support tickets.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const existingClaim =
    supportTicketClaims.get(interaction.channel.id);

  if (existingClaim) {
    return interaction.reply({
      content: `This ticket is already claimed by <@${existingClaim}>.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  supportTicketClaims.set(
    interaction.channel.id,
    interaction.user.id
  );

  const requesterOverwrite =
    interaction.channel.permissionOverwrites.cache.find(
      overwrite =>
        overwrite.type === 1 &&
        overwrite.id !== client.user.id &&
        overwrite.id !== interaction.user.id
    );

  const requesterId = requesterOverwrite?.id;

  if (requesterId) {
    await interaction.channel.permissionOverwrites.edit(
      requesterId,
      {
        SendMessages: false,
      }
    );
  }

  await interaction.channel.permissionOverwrites.edit(
    interaction.user.id,
    {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
    }
  );

  await interaction.channel.permissionOverwrites.edit(
    MM_APPLICATION_EXECUTIVE_ROLE_ID,
    {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
    }
  );

  const claimedContainer =
    new ContainerBuilder()
      .setAccentColor(0x22C55E)

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent("## Ticket Claimed")
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# CLAIMER\n<@${interaction.user.id}>`
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent("-# STATUS\n`Active`")
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Only the **claimer** can reply in this ticket. **Executive** keeps full oversight."
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Vanta Central Middleman Service"
          )
      );

  await interaction.channel.send({
    components: [claimedContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  const claimedButtons =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("support_ticket_claimed")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),

        new ButtonBuilder()
          .setCustomId("support_ticket_unclaim")
          .setLabel("Unclaim")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("support_ticket_close")
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger)
      );

  await interaction.message.edit({
    components: [claimedButtons],
  });

  await interaction.reply({
    content: "You have claimed this support ticket.",
    flags: MessageFlags.Ephemeral,
  });

  return;
}
if (
  interaction.isButton() &&
  interaction.customId === "support_ticket_unclaim"
) {
  const claimerId =
    supportTicketClaims.get(interaction.channel.id);

  if (!claimerId) {
    return interaction.reply({
      content: "This ticket is not currently claimed.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (claimerId !== interaction.user.id) {
    return interaction.reply({
      content: "Only the current claimer can unclaim this ticket.",
      flags: MessageFlags.Ephemeral,
    });
  }

  supportTicketClaims.delete(interaction.channel.id);

  const requesterOverwrite =
    interaction.channel.permissionOverwrites.cache.find(
      overwrite =>
        overwrite.type === 1 &&
        overwrite.id !== client.user.id &&
        overwrite.id !== interaction.user.id
    );

  const requesterId = requesterOverwrite?.id;

  if (requesterId) {
    await interaction.channel.permissionOverwrites.edit(
      requesterId,
      {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      }
    );
  }

  await interaction.channel.permissionOverwrites.delete(
    interaction.user.id
  );

  const buttons =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("support_ticket_claim")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("support_ticket_close")
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger)
      );

  await interaction.message.edit({
    components: [buttons],
  });

  await interaction.reply({
    content: "You have unclaimed this support ticket.",
    flags: MessageFlags.Ephemeral,
  });

  return;
}

if (
  interaction.isButton() &&
  interaction.customId === "support_ticket_close"
) {
  const member =
    await interaction.guild.members.fetch(interaction.user.id);

  const claimerId =
    supportTicketClaims.get(interaction.channel.id);

  const isExecutive =
    member.roles.cache.has(MM_APPLICATION_EXECUTIVE_ROLE_ID);

  const isClaimer =
    claimerId === interaction.user.id;

  if (!isExecutive && !isClaimer) {
    return interaction.reply({
      content:
        "Only the claimer or an Executive can close this ticket.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.reply({
    content: "Saving transcript and closing ticket...",
    flags: MessageFlags.Ephemeral,
  });

  await closeTicketChannel(interaction.channel, {
    type: "Support",
    closedBy: interaction.user,
    reason: "Support ticket closed",
  });

  return;
}
if (
  interaction.isButton() &&
  interaction.customId === "report_user_claim"
) {
  const member =
    await interaction.guild.members.fetch(interaction.user.id);

  if (!member.roles.cache.has(REPORT_USER_STAFF_ROLE_ID)) {
    return interaction.reply({
      content: "Only Middleman staff can claim user reports.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const existingClaim =
    reportUserClaims.get(interaction.channel.id);

  if (existingClaim) {
    return interaction.reply({
      content: `This report is already claimed by <@${existingClaim}>.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  reportUserClaims.set(
    interaction.channel.id,
    interaction.user.id
  );

  const reporterOverwrite =
    interaction.channel.permissionOverwrites.cache.find(
      overwrite =>
        overwrite.type === 1 &&
        overwrite.id !== client.user.id &&
        overwrite.id !== interaction.user.id
    );

  const reporterId = reporterOverwrite?.id;

  if (reporterId) {
    await interaction.channel.permissionOverwrites.edit(
      reporterId,
      {
        SendMessages: false,
      }
    );
  }

  await interaction.channel.permissionOverwrites.edit(
    interaction.user.id,
    {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
    }
  );

  await interaction.channel.permissionOverwrites.edit(
    MM_APPLICATION_EXECUTIVE_ROLE_ID,
    {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
    }
  );

  const claimedContainer =
    new ContainerBuilder()
      .setAccentColor(0x22C55E)

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent("## Ticket Claimed")
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# CLAIMER\n<@${interaction.user.id}>`
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent("-# STATUS\n`Active`")
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Only the **claimer** can reply in this ticket. **Executive** keeps full oversight."
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Vanta Central Middleman Service"
          )
      );

  await interaction.channel.send({
    components: [claimedContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  const claimedButtons =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("report_user_claimed")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),

        new ButtonBuilder()
          .setCustomId("report_user_unclaim")
          .setLabel("Unclaim")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("report_user_close")
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger)
      );

  await interaction.message.edit({
    components: [claimedButtons],
  });

  await interaction.reply({
    content: "You have claimed this user report.",
    flags: MessageFlags.Ephemeral,
  });

  return;
}
if (
  interaction.isButton() &&
  interaction.customId === "report_user_unclaim"
) {
  const claimerId =
    reportUserClaims.get(interaction.channel.id);

  if (!claimerId) {
    return interaction.reply({
      content: "This report is not currently claimed.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (claimerId !== interaction.user.id) {
    return interaction.reply({
      content: "Only the current claimer can unclaim this report.",
      flags: MessageFlags.Ephemeral,
    });
  }

  reportUserClaims.delete(interaction.channel.id);

  const reporterOverwrite =
    interaction.channel.permissionOverwrites.cache.find(
      overwrite =>
        overwrite.type === 1 &&
        overwrite.id !== client.user.id &&
        overwrite.id !== interaction.user.id
    );

  const reporterId = reporterOverwrite?.id;

  if (reporterId) {
    await interaction.channel.permissionOverwrites.edit(
      reporterId,
      {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      }
    );
  }

  await interaction.channel.permissionOverwrites.delete(
    interaction.user.id
  );

  const buttons =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("report_user_claim")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("report_user_close")
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger)
      );

  await interaction.message.edit({
    components: [buttons],
  });

  await interaction.reply({
    content: "You have unclaimed this user report.",
    flags: MessageFlags.Ephemeral,
  });

  return;
}
if (
  interaction.isButton() &&
  interaction.customId === "report_user_close"
) {
  const member =
    await interaction.guild.members.fetch(interaction.user.id);

  const claimerId =
    reportUserClaims.get(interaction.channel.id);

  const isExecutive =
    member.roles.cache.has(MM_APPLICATION_EXECUTIVE_ROLE_ID);

  const isClaimer =
    claimerId === interaction.user.id;

  if (!isExecutive && !isClaimer) {
    return interaction.reply({
      content:
        "Only the claimer or an Executive can close this report.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.reply({
    content: "Saving transcript and closing report...",
    flags: MessageFlags.Ephemeral,
  });

  await closeTicketChannel(interaction.channel, {
    type: "Report User",
    closedBy: interaction.user,
    reason: "Report closed",
  });

  return;
}

  if (
  interaction.isButton() &&
  interaction.customId === "support_ticket_start"
) {
  const modal =
    new ModalBuilder()
      .setCustomId("support_ticket_modal")
      .setTitle("Support Ticket");

  const issueInput =
    new TextInputBuilder()
      .setCustomId("support_issue")
      .setLabel("What would you like help with?")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Describe what you need help with")
      .setRequired(true);

  const urgencyInput =
    new TextInputBuilder()
      .setCustomId("support_urgency")
      .setLabel("How urgent is this? (1-10)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("1-10")
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(issueInput),
    new ActionRowBuilder().addComponents(urgencyInput)
  );

  await interaction.showModal(modal);
  return;
}

if (
  interaction.isModalSubmit() &&
  interaction.customId === "support_ticket_modal"
) {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  try {
    const issue =
      interaction.fields.getTextInputValue("support_issue");

    const urgency =
      interaction.fields.getTextInputValue("support_urgency");

    const ticketChannel =
      await createSupportTicket(interaction, {
        issue,
        urgency,
      });

    await interaction.editReply({
      content: `Your support ticket has been created: <#${ticketChannel.id}>`,
    });
  } catch (error) {
    console.error("[SUPPORT TICKET] Error:", error);

    await interaction.editReply({
      content: "Failed to create your support ticket.",
    });
  }

  return;
}
if (
  interaction.isButton() &&
  interaction.customId === "report_user_start"
) {
  const modal =
    new ModalBuilder()
      .setCustomId("report_user_modal")
      .setTitle("Report User");

  const userInput =
    new TextInputBuilder()
      .setCustomId("report_user")
      .setLabel("User (ID or @username)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("User ID or @username")
      .setRequired(true);

  const categoryInput =
    new TextInputBuilder()
      .setCustomId("report_category")
      .setLabel("Category")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Scammer / DWC / Timewaster")
      .setRequired(true);

  const reasonInput =
    new TextInputBuilder()
      .setCustomId("report_reason")
      .setLabel("Reason & proof (links accepted)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Explain what happened and provide proof")
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(userInput),
    new ActionRowBuilder().addComponents(categoryInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );

  await interaction.showModal(modal);
  return;
}
if (
  interaction.isModalSubmit() &&
  interaction.customId === "report_user_modal"
) {
  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  try {
    const user =
      interaction.fields.getTextInputValue("report_user");

    const category =
      interaction.fields.getTextInputValue("report_category");

    const reason =
      interaction.fields.getTextInputValue("report_reason");

    const ticketChannel =
      await createReportUserTicket(interaction, {
        user,
        category,
        reason,
      });

    await interaction.editReply({
      content: `Your report has been submitted: <#${ticketChannel.id}>`,
    });
  } catch (error) {
    console.error("[REPORT USER] Error:", error);

    await interaction.editReply({
      content: "Failed to create the report ticket.",
    });
  }

  return;
}
  if (
    interaction.isButton() &&
    interaction.customId === "mm_application_start"
  ) {
    const modal =
      new ModalBuilder()
        .setCustomId("mm_application_modal")
        .setTitle("Middleman Application");

    const vouchesInput =
      new TextInputBuilder()
        .setCustomId("mm_app_vouches")
        .setLabel("Total vouches (250+ required)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Example: 350")
        .setRequired(true);

    const experienceInput =
      new TextInputBuilder()
        .setCustomId("mm_app_experience")
        .setLabel("Past middleman experience")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe your previous MM experience")
        .setRequired(true);

    const collateralInput =
      new TextInputBuilder()
        .setCustomId("mm_app_collateral")
        .setLabel("Collateral you can provide")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Describe your available collateral")
        .setRequired(true);

    const availabilityInput =
      new TextInputBuilder()
        .setCustomId("mm_app_availability")
        .setLabel("Timezone & daily availability")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Example: CET • 16:00–23:00")
        .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        vouchesInput
      ),

      new ActionRowBuilder().addComponents(
        experienceInput
      ),

      new ActionRowBuilder().addComponents(
        collateralInput
      ),

      new ActionRowBuilder().addComponents(
        availabilityInput
      )
    );

    await interaction.showModal(modal);

    return;
  }

  // ============================================================
  // MIDDLEMAN APPLICATION — SUBMIT
  // ============================================================

  if (
    interaction.isModalSubmit() &&
    interaction.customId === "mm_application_modal"
  ) {
    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    const vouches =
      interaction.fields.getTextInputValue(
        "mm_app_vouches"
      );

    const experience =
      interaction.fields.getTextInputValue(
        "mm_app_experience"
      );

    const collateral =
      interaction.fields.getTextInputValue(
        "mm_app_collateral"
      );

    const availability =
      interaction.fields.getTextInputValue(
        "mm_app_availability"
      );

    // ----------------------------------------------------------
    // 250+ VOUCH CHECK
    // ----------------------------------------------------------

    const vouchNumber =
      Number(
        vouches.replace(/[^0-9]/g, "")
      );

    if (
      !Number.isFinite(vouchNumber) ||
      vouchNumber < 250
    ) {
      return interaction.editReply({
        content:
          "You need at least **250 vouches** to apply for Middleman.",
      });
    }

    try {
      const ticket =
        await createMiddlemanApplicationTicket(
          interaction,
          {
            vouches,
            experience,
            collateral,
            availability,
          }
        );

      await interaction.editReply({
        content:
          `Your Middleman application has been submitted: ${ticket}`,
      });

    } catch (error) {
      console.error(
        "[MIDDLEMAN APPLICATION] Ticket creation error:",
        error
      );

      await interaction.editReply({
        content:
          "Something went wrong while creating your application ticket.",
      });
    }

    return;
  }
    // ============================================================
  // MIDDLEMAN APPLICATION — CLAIM
  // ============================================================

  if (
    interaction.isButton() &&
    interaction.customId === "mm_application_claim"
  ) {
    const member =
      await interaction.guild.members.fetch(
        interaction.user.id
      );

    if (
      !member.roles.cache.has(
        MM_APPLICATION_STAFF_ROLE_ID
      )
    ) {
      return interaction.reply({
        content:
          "Only Middleman staff can claim applications.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check whether already claimed
    const existingClaim =
      middlemanApplicationClaims.get(
        interaction.channel.id
      );

    if (existingClaim) {
      return interaction.reply({
        content:
          `This application is already claimed by <@${existingClaim}>.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    middlemanApplicationClaims.set(
      interaction.channel.id,
      interaction.user.id
    );

    // ----------------------------------------------------------
    // Find applicant from permission overwrites
    // ----------------------------------------------------------

    const applicantOverwrite =
      interaction.channel.permissionOverwrites.cache.find(
        overwrite =>
          overwrite.type === 1 &&
          overwrite.id !== client.user.id &&
          overwrite.id !== interaction.user.id
      );

    const applicantId =
      applicantOverwrite?.id;

    // ----------------------------------------------------------
    // Applicant can no longer reply
    // ----------------------------------------------------------

    if (applicantId) {
      await interaction.channel.permissionOverwrites.edit(
        applicantId,
        {
          SendMessages: false,
        }
      );
    }

    // ----------------------------------------------------------
    // Claimer gets explicit permission
    // ----------------------------------------------------------

    await interaction.channel.permissionOverwrites.edit(
      interaction.user.id,
      {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      }
    );

    // ----------------------------------------------------------
    // Executive keeps full access
    // ----------------------------------------------------------

    await interaction.channel.permissionOverwrites.edit(
      MM_APPLICATION_EXECUTIVE_ROLE_ID,
      {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      }
    );

    // ----------------------------------------------------------
    // Claimed container
    // ----------------------------------------------------------

    const claimedContainer =
      new ContainerBuilder()
        .setAccentColor(0x22C55E)

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              "## Ticket Claimed"
            )
        )

        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(
              SeparatorSpacingSize.Small
            )
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              `-# CLAIMER\n<@${interaction.user.id}>`
            )
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              "-# STATUS\n`Active`"
            )
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              "-# Only the **claimer** can reply in this ticket. **Executive** keeps full oversight."
            )
        )

        .addSeparatorComponents(
          new SeparatorBuilder()
            .setSpacing(
              SeparatorSpacingSize.Small
            )
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              "-# Vanta Central Middleman Service"
            )
        );

    await interaction.channel.send({
      components: [claimedContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    // ----------------------------------------------------------
    // Replace buttons
    // ----------------------------------------------------------

    const claimedButtons =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId("mm_application_claimed_disabled")
            .setLabel("Claimed")
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),

          new ButtonBuilder()
            .setCustomId("mm_application_unclaim")
            .setLabel("Unclaim")
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId("mm_application_close")
            .setLabel("Close")
            .setStyle(ButtonStyle.Danger)
        );

    await interaction.message.edit({
      components: [claimedButtons],
    });

    await interaction.reply({
      content:
        "You have claimed this Middleman application.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ============================================================
  // MIDDLEMAN APPLICATION — UNCLAIM
  // ============================================================

  if (
    interaction.isButton() &&
    interaction.customId === "mm_application_unclaim"
  ) {
    const claimerId =
      middlemanApplicationClaims.get(
        interaction.channel.id
      );

    if (!claimerId) {
      return interaction.reply({
        content:
          "This application is not currently claimed.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (
      interaction.user.id !== claimerId
    ) {
      return interaction.reply({
        content:
          "Only the current claimer can unclaim this ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }

    middlemanApplicationClaims.delete(
      interaction.channel.id
    );

    // ----------------------------------------------------------
    // Find applicant
    // ----------------------------------------------------------

    const applicantOverwrite =
      interaction.channel.permissionOverwrites.cache.find(
        overwrite =>
          overwrite.type === 1 &&
          overwrite.id !== client.user.id &&
          overwrite.id !== claimerId
      );

    const applicantId =
      applicantOverwrite?.id;

    // ----------------------------------------------------------
    // Applicant can reply again
    // ----------------------------------------------------------

    if (applicantId) {
      await interaction.channel.permissionOverwrites.edit(
        applicantId,
        {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
        }
      );
    }

    // Remove explicit claimer overwrite
    await interaction.channel.permissionOverwrites.delete(
      claimerId
    ).catch(() => {});

    // ----------------------------------------------------------
    // Restore claim + close buttons
    // ----------------------------------------------------------

    const buttons =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId("mm_application_claim")
            .setLabel("Claim")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("mm_application_close")
            .setLabel("Close")
            .setStyle(ButtonStyle.Danger)
        );

    await interaction.message.edit({
      components: [buttons],
    });

    await interaction.reply({
      content:
        "You have unclaimed this Middleman application.",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // ============================================================
  // MIDDLEMAN APPLICATION — CLOSE
  // ============================================================

  if (
    interaction.isButton() &&
    interaction.customId === "mm_application_close"
  ) {
    const member =
      await interaction.guild.members.fetch(
        interaction.user.id
      );

    const claimerId =
      middlemanApplicationClaims.get(
        interaction.channel.id
      );

    const isExecutive =
      member.roles.cache.has(
        MM_APPLICATION_EXECUTIVE_ROLE_ID
      );

    const isClaimer =
      claimerId === interaction.user.id;

    if (
      !isExecutive &&
      !isClaimer
    ) {
      return interaction.reply({
        content:
          "Only the current claimer or Executive staff can close this ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      content:
        "Saving transcript and closing this Middleman application...",
      flags: MessageFlags.Ephemeral,
    });

    await closeTicketChannel(interaction.channel, {
      type: "Middleman Application",
      closedBy: interaction.user,
      reason: "Middleman application closed",
    });

    return;
  }

    // ============================================================
// AUTO MIDDLEMAN — BTC START
// ============================================================

if (
  interaction.isButton() &&
  interaction.customId.startsWith("automiddleman_")
) {
const currencies = {
  btc: {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
  },

  eth: {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
  },

  ltc: {
    id: "ltc",
    name: "Litecoin",
    symbol: "LTC",
  },

  sol: {
    id: "sol",
    name: "Solana",
    symbol: "SOL",
  },

  usdt_bsc: {
    id: "usdt_bsc",
    name: "Tether USD",
    symbol: "USDT",
    network: "BSC",
  },

  usdt_eth: {
    id: "usdt_eth",
    name: "Tether USD",
    symbol: "USDT",
    network: "Ethereum",
  },

  usdt_sol: {
    id: "usdt_sol",
    name: "Tether USD",
    symbol: "USDT",
    network: "Solana",
  },

  usdc_eth: {
    id: "usdc_eth",
    name: "USD Coin",
    symbol: "USDC",
    network: "Ethereum",
  },

  usdc_sol: {
    id: "usdc_sol",
    name: "USD Coin",
    symbol: "USDC",
    network: "Solana",
  },
};

const currencyId =
  interaction.customId.replace(
    "automiddleman_",
    ""
  );

const currency =
  currencies[currencyId];

if (!currency) {
  return interaction.reply({
    content:
      "This cryptocurrency is not supported.",
    flags: MessageFlags.Ephemeral,
  });
}
  await interaction.deferReply({
  flags: MessageFlags.Ephemeral,
});

  try {
    const guild = interaction.guild;

    const ticketName =
      getNextAutoMmTicketName();

    const ticketCode =
      generateAutoMmCode();

    const ticketChannel =
      await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: MM_TICKET_CATEGORY_ID,

        permissionOverwrites: [
          {
            id: guild.id,
            deny: ["ViewChannel"],
          },

          {
            id: interaction.user.id,
            allow: [
              "ViewChannel",
              "SendMessages",
              "ReadMessageHistory",
              "AttachFiles",
            ],
          },

          {
            id: MIDDLEMAN_ROLE_ID,
            allow: [
              "ViewChannel",
              "SendMessages",
              "ReadMessageHistory",
              "AttachFiles",
            ],
          },

          {
            id: client.user.id,
            allow: [
              "ViewChannel",
              "SendMessages",
              "ReadMessageHistory",
              "ManageChannels",
              "ManageMessages",
            ],
          },
        ],
      });

    registerTicketMeta(ticketChannel.id, "Auto Middleman", interaction.user.id);

 const state = {
  ticketId: ticketChannel.id,
  ticketName,
  code: ticketCode,
  creatorId: interaction.user.id,

  currencyId: currency.id,
  currencyName: currency.name,
  currencySymbol: currency.symbol,
  currencyNetwork: currency.network || null,

  partnerId: null,
  senderId: null,
  receiverId: null,

  roleConfirmations: new Set(),

  dealAmount: null,
  amountConfirmations: new Set(),

  feeType: null,
  feeConfirmations: new Set(),

  stage: "partner",

  roleMessageId: null,
  roleConfirmationMessageId: null,
  amountMessageId: null,
  amountConfirmationMessageId: null,
  feeMessageId: null,
  feeConfirmationMessageId: null,
};

    autoMiddlemanStates.set(
      ticketChannel.id,
      state
    );

    // Ticket code + creator
 // Combination code
await ticketChannel.send({
  content: `\`${ticketCode}\``,
});

const openingContainer =
  new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Vanta Central | Automated Crypto Middleman"
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**${currency.name} escrow ticket opened.**`,
          "",
          "Welcome! Your funds will be held securely in escrow for the duration of this deal.",
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      autoMmDivider()
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# Ticket: ${ticketName} • ${currency.name}${
  currency.network
    ? ` • ${currency.network}`
    : ""
}`,
      )
    );

    await ticketChannel.send({
      components: [openingContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    const securityContainer =
      new ContainerBuilder()
        .setAccentColor(0xef4444)

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "## Security Notice"
          )
        )

        .addSeparatorComponents(
          autoMmDivider()
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              "**Staff will never DM you first.** Anyone claiming to be staff via DM is a scammer.",
              "",
              "> All deal activity must happen inside this ticket.",
              "> Deals conducted outside of this ticket are **not protected**.",
              "",
              "If you are unsure about anything, ask in this channel — never in DMs.",
            ].join("\n")
          )
        )

        .addSeparatorComponents(
          autoMmDivider()
        )

        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("auto_mm_close")
              .setLabel("Close Ticket")
              .setStyle(ButtonStyle.Secondary)
          )
        );

    await ticketChannel.send({
      components: [securityContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    const partnerContainer =
      new ContainerBuilder()
        .setAccentColor(0x8b5cf6)

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "## Add Your Trade Partner"
          )
        )

        .addSeparatorComponents(
          autoMmDivider()
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              "To get started, you need to add the person you are trading with.",
              "",
              "> **Mention them** — `@Username`",
              "> **Or paste their User ID** — `123456789012345678`",
            ].join("\n")
          )
        )

        .addSeparatorComponents(
          autoMmDivider()
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "-# Vanta Central Middleman Service"
          )
        );

    await ticketChannel.send({
      components: [partnerContainer],
      flags: MessageFlags.IsComponentsV2,
    });

    await interaction.editReply({
      content:
  `Your ${currency.name} ticket has been created: ${ticketChannel}`,
    });

  } catch (error) {
   console.error(
  `AutoMiddleman ${currency.name} ticket error:`,
  error
);

    await interaction.editReply({
      content:
        `Something went wrong while creating the ${currency.name} ticket.`,
    });
  }

  return;
}


// ============================================================
// AUTO MIDDLEMAN — BUTTONS
// ============================================================

if (
  interaction.isButton() &&
  interaction.customId.startsWith("auto_mm_")
) {
  const state =
    autoMiddlemanStates.get(
      interaction.channel.id
    );

  if (!state) {
    return interaction.reply({
      content:
        "This AutoMiddleman session could not be found.",
      ephemeral: true,
    });
  }

  // ----------------------------------------------------------
  // CLOSE
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    "auto_mm_close"
  ) {
    await interaction.reply({
      content:
        "Saving transcript and closing this ticket...",
      flags: MessageFlags.Ephemeral,
    });

    await closeTicketChannel(interaction.channel, {
      type: "Auto Middleman",
      closedBy: interaction.user,
      reason: "Auto Middleman ticket closed",
    });

    return;
  }

  // ----------------------------------------------------------
  // ROLE — SENDER
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    "auto_mm_role_sender"
  ) {
    if (
      interaction.user.id !== state.creatorId &&
      interaction.user.id !== state.partnerId
    ) {
      return interaction.reply({
        content:
          "Only the two traders can select roles.",
        ephemeral: true,
      });
    }

    if (
      state.receiverId ===
      interaction.user.id
    ) {
      return interaction.reply({
        content:
          "You are already assigned as the receiver. Reset the roles before changing.",
        ephemeral: true,
      });
    }

    state.senderId =
      interaction.user.id;

    state.roleConfirmations.clear();

    await interaction.update({
      components: [
        buildAutoMmRoleContainer(state),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    if (
      state.senderId &&
      state.receiverId
    ) {
      state.stage = "role_confirmation";

      await interaction.channel.send({
          content:
            `<@${state.senderId}> <@${state.receiverId}>`,
          allowedMentions: {
            users: [
              state.senderId,
              state.receiverId,
            ],
          },
        });

      const confirmationContainer =
        buildAutoMmRoleConfirmation(state);

      const msg =
        await interaction.channel.send({
          components: [
            confirmationContainer,
          ],
          flags: MessageFlags.IsComponentsV2,
        });

      state.roleConfirmationMessageId =
        msg.id;
    }

    return;
  }

  // ----------------------------------------------------------
  // ROLE — RECEIVER
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    "auto_mm_role_receiver"
  ) {
    if (
      interaction.user.id !== state.creatorId &&
      interaction.user.id !== state.partnerId
    ) {
      return interaction.reply({
        content:
          "Only the two traders can select roles.",
        ephemeral: true,
      });
    }

    if (
      state.senderId ===
      interaction.user.id
    ) {
      return interaction.reply({
        content:
          "You are already assigned as the sender. Reset the roles before changing.",
        ephemeral: true,
      });
    }

    state.receiverId =
      interaction.user.id;

    state.roleConfirmations.clear();

    await interaction.update({
      components: [
        buildAutoMmRoleContainer(state),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    if (
      state.senderId &&
      state.receiverId
    ) {
      state.stage = "role_confirmation";

      await interaction.channel.send({
        content:
          `<@${state.senderId}> <@${state.receiverId}>`,
        allowedMentions: {
          users: [
            state.senderId,
            state.receiverId,
          ],
        },
      });

      const msg =
        await interaction.channel.send({
          components: [
            buildAutoMmRoleConfirmation(state),
          ],
          flags: MessageFlags.IsComponentsV2,
        });

      state.roleConfirmationMessageId =
        msg.id;
    }

    return;
  }

  // ----------------------------------------------------------
  // RESET ROLES
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    "auto_mm_role_reset"
  ) {
    if (
      interaction.user.id !== state.creatorId &&
      interaction.user.id !== state.partnerId
    ) {
      return interaction.reply({
        content:
          "Only the traders can reset the roles.",
        ephemeral: true,
      });
    }

    state.senderId = null;
    state.receiverId = null;
    state.roleConfirmations.clear();
    state.stage = "roles";

    await interaction.update({
      components: [
        buildAutoMmRoleContainer(state),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    return;
  }

  // ----------------------------------------------------------
// ROLE CONFIRM — CORRECT
// ----------------------------------------------------------

if (
  interaction.customId ===
  "auto_mm_roles_correct"
) {
  if (
    interaction.user.id !== state.senderId &&
    interaction.user.id !== state.receiverId
  ) {
    return interaction.reply({
      content:
        "Only the two traders can confirm the roles.",
      flags: MessageFlags.Ephemeral,
    });
  }

  state.roleConfirmations.add(
    interaction.user.id
  );

  // --------------------------------------------------------
  // BOTH USERS HAVE CONFIRMED
  // --------------------------------------------------------

  if (
    state.roleConfirmations.has(state.senderId) &&
    state.roleConfirmations.has(state.receiverId)
  ) {
    await interaction.update({
      components: [
        new ContainerBuilder()
          .setAccentColor(0x22c55e)

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Both users confirmed, lets move on to the next step!**"
            )
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    state.stage = "amount";

    await interaction.channel.send({
      content:
        `<@${state.senderId}>`,
      allowedMentions: {
        users: [state.senderId],
      },
    });

    const amountMessage =
      await interaction.channel.send({
        components: [
          buildAutoMmAmountContainer(),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

    state.amountMessageId =
      amountMessage.id;

    return;
  }

  // --------------------------------------------------------
  // ONLY ONE USER HAS CONFIRMED
  // KEEP THE BUTTONS VISIBLE
  // --------------------------------------------------------

  const senderStatus =
    state.roleConfirmations.has(state.senderId)
      ? "✅ Confirmed"
      : "⏳ Waiting";

  const receiverStatus =
    state.roleConfirmations.has(state.receiverId)
      ? "✅ Confirmed"
      : "⏳ Waiting";

  await interaction.update({
    components: [
      new ContainerBuilder()
        .setAccentColor(0x8b5cf6)

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "## Confirm Roles"
          )
        )

        .addSeparatorComponents(
          autoMmDivider()
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              "Both users must confirm that the roles below are correct.",
              "",
              `<:Arrow:1555884377282453534> **Sending ${state.currencyName}**`,
              `<@${state.senderId}> — ${senderStatus}`,
              "",
              `<:Arrow:1555884377282453534> **Receiving ${state.currencyName}**`,
              `<@${state.receiverId}> — ${receiverStatus}`,
            ].join("\n")
          )
        )

        .addSeparatorComponents(
          autoMmDivider()
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "-# Both users must confirm before continuing."
          )
        )

        .addSeparatorComponents(
          autoMmDivider()
        )

        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(
                "auto_mm_roles_correct"
              )
              .setLabel("Correct")
              .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
              .setCustomId(
                "auto_mm_roles_incorrect"
              )
              .setLabel("Incorrect")
              .setStyle(ButtonStyle.Secondary)
          )
        ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });

  return;
}
  // ----------------------------------------------------------
  // ROLE CONFIRM — INCORRECT
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    "auto_mm_roles_incorrect"
  ) {
    state.senderId = null;
    state.receiverId = null;
    state.roleConfirmations.clear();
    state.stage = "roles";
    await interaction.update({
      components: [
        buildAutoMmRoleContainer(state),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    return;
  }

// ----------------------------------------------------------
// AMOUNT CONFIRM — CORRECT
// ----------------------------------------------------------

if (
  interaction.customId ===
  "auto_mm_amount_correct"
) {
  if (
    interaction.user.id !== state.senderId &&
    interaction.user.id !== state.receiverId
  ) {
    return interaction.reply({
      content:
        "Only the two traders can confirm the amount.",
      flags: MessageFlags.Ephemeral,
    });
  }

  state.amountConfirmations.add(
    interaction.user.id
  );

  // --------------------------------------------------------
  // BOTH USERS HAVE CONFIRMED
  // --------------------------------------------------------

  if (
    state.amountConfirmations.has(state.senderId) &&
    state.amountConfirmations.has(state.receiverId)
  ) {
    await interaction.update({
      components: [
        new ContainerBuilder()
          .setAccentColor(0x22c55e)

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "**Both users confirmed the deal amount.**"
            )
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    state.stage = "fee";

    const feeMessage =
      await interaction.channel.send({
        components: [
          buildAutoMmFeeContainer(),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

    state.feeMessageId =
      feeMessage.id;

    return;
  }

  // --------------------------------------------------------
  // ONLY ONE USER HAS CONFIRMED
  // KEEP THE BUTTONS VISIBLE
  // --------------------------------------------------------

  const senderStatus =
    state.amountConfirmations.has(state.senderId)
      ? "✅ Confirmed"
      : "⏳ Waiting";

  const receiverStatus =
    state.amountConfirmations.has(state.receiverId)
      ? "✅ Confirmed"
      : "⏳ Waiting";

  await interaction.update({
    components: [
      new ContainerBuilder()
        .setAccentColor(0x8b5cf6)

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "## Confirm Deal Amount"
          )
        )

        .addSeparatorComponents(
          autoMmDivider()
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            [
              "Both users must confirm the USD amount of this deal.",
              "",
              `<:Arrow:1555884377282453534> **Amount**`,
              `$${state.dealAmount}`,
              "",
              `<:Arrow:1555884377282453534> **Sender**`,
              `<@${state.senderId}> — ${senderStatus}`,
              "",
              `<:Arrow:1555884377282453534> **Receiver**`,
              `<@${state.receiverId}> — ${receiverStatus}`,
            ].join("\n")
          )
        )

        .addSeparatorComponents(
          autoMmDivider()
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "-# Both users must confirm before continuing."
          )
        )

        .addSeparatorComponents(
          autoMmDivider()
        )

        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(
                "auto_mm_amount_correct"
              )
              .setLabel("Correct")
              .setStyle(
                ButtonStyle.Success
              ),

            new ButtonBuilder()
              .setCustomId(
                "auto_mm_amount_incorrect"
              )
              .setLabel("Incorrect")
              .setStyle(
                ButtonStyle.Secondary
              )
          )
        ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });

  return;
}

  // ----------------------------------------------------------
  // AMOUNT CONFIRM — INCORRECT
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    "auto_mm_amount_incorrect"
  ) {
    state.dealAmount = null;
    state.amountConfirmations.clear();
    state.stage = "amount";

    await interaction.update({
      components: [
        buildAutoMmAmountContainer(),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    await interaction.channel.send({
      content:
        `<@${state.senderId}>, please enter the correct USD amount.`,
      allowedMentions: {
        users: [state.senderId],
      },
    });

    return;
  }

  // ----------------------------------------------------------
  // FEE SELECTION
  // ----------------------------------------------------------

  if (
    [
      "auto_mm_fee_sender",
      "auto_mm_fee_receiver",
      "auto_mm_fee_split",
    ].includes(interaction.customId)
  ) {
    if (
      interaction.user.id !== state.senderId &&
      interaction.user.id !== state.receiverId
    ) {
      return interaction.reply({
        content:
          "Only the two traders can select the fee arrangement.",
        ephemeral: true,
      });
    }

    if (
      interaction.customId ===
      "auto_mm_fee_sender"
    ) {
      state.feeType = "sender";
    }

    if (
      interaction.customId ===
      "auto_mm_fee_receiver"
    ) {
      state.feeType = "receiver";
    }

    if (
      interaction.customId ===
      "auto_mm_fee_split"
    ) {
      state.feeType = "split";
    }

    state.feeConfirmations.clear();
    state.stage = "fee_confirmation";

    await interaction.update({
      components: [
        buildAutoMmFeeConfirmation(state),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    return;
  }

// ----------------------------------------------------------
// FEE CONFIRM — CORRECT
// ----------------------------------------------------------

if (
  interaction.customId ===
  "auto_mm_fee_correct"
) {
  const isSender =
    interaction.user.id === state.senderId;

  const isReceiver =
    interaction.user.id === state.receiverId;

  if (!isSender && !isReceiver) {
    return interaction.reply({
      content:
        "Only the sender and receiver can confirm the fee.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // Prevent the same person from confirming twice
  if (
    state.feeConfirmations.has(
      interaction.user.id
    )
  ) {
    return interaction.reply({
      content:
        "You have already confirmed the fee.",
      flags: MessageFlags.Ephemeral,
    });
  }

  state.feeConfirmations.add(
    interaction.user.id
  );

  // --------------------------------------------------------
  // FIRST USER
  // DO NOT EDIT THE ORIGINAL MESSAGE
  // --------------------------------------------------------

  if (
    state.feeConfirmations.size === 1
  ) {
    return interaction.reply({
      content:
        "✅ Your fee confirmation has been recorded. Waiting for the other trader.",
      flags: MessageFlags.Ephemeral,
    });
  }

  // --------------------------------------------------------
  // BOTH USERS HAVE CONFIRMED
  // --------------------------------------------------------

  if (
    state.feeConfirmations.has(state.senderId) &&
    state.feeConfirmations.has(state.receiverId)
  ) {
    await interaction.update({
      components: [
        new ContainerBuilder()
          .setAccentColor(0x22c55e)

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "## Fee Confirmed"
            )
          )

          .addSeparatorComponents(
            autoMmDivider()
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "Both users confirmed the Middleman fee."
            )
          )

          .addSeparatorComponents(
            autoMmDivider()
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "-# Moving to the final deal summary..."
            )
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    state.stage = "summary";

    const summaryMessage =
      await interaction.channel.send({
        components: [
          buildAutoMmSummary(state),
        ],
        flags: MessageFlags.IsComponentsV2,
      });

    state.summaryMessageId =
      summaryMessage.id;

const cryptoRate =
  await getCryptoUsdRate(
    state.currencyId
  );

const invoiceMessage =
  await interaction.channel.send({
    components: [
      buildAutoMmTestInvoice(
        state,
        cryptoRate
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  });

state.invoiceMessageId =
  invoiceMessage.id;

return;
}
}
// ----------------------------------------------------------
// FEE CONFIRM — CHANGE
// ----------------------------------------------------------

if (
  interaction.customId ===
  "auto_mm_fee_change"
) {
    state.feeType = null;
    state.feeConfirmations.clear();
    state.stage = "fee";

    await interaction.update({
      components: [
        buildAutoMmFeeContainer(),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    return;
  }
}

    // ============================================================
// FEE AGREEMENT BUTTONS
// ============================================================

if (
  interaction.isButton() &&
  (
    interaction.customId === "fee_5050" ||
    interaction.customId === "fee_100"
  )
) {
  const coverage =
    interaction.customId === "fee_5050"
      ? "50/50 split"
      : "Full service fee";

  const divider =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  const agreementContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "## Service Fee Agreement"
          )
      )

      .addSeparatorComponents(
        divider
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `-# AGREED BY\n` +
            `<@${interaction.user.id}>\n\n` +

            `-# COVERAGE\n` +
            `\`${coverage}\`\n\n` +

            `-# Decision logged. Proceed with the transaction.`
          )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            "-# Vanta Central Middleman Service"
          )
      );

  await interaction.update({
    components: [
      agreementContainer,
    ],
    flags:
      MessageFlags.IsComponentsV2,
  });

  return;
}

    // ============================================================
// FLOP — ACCEPT / DECLINE
// ============================================================

if (
  interaction.isButton() &&
  (
    interaction.customId.startsWith(
      "flop_accept_"
    ) ||
    interaction.customId.startsWith(
      "flop_decline_"
    )
  )
) {
  const targetUserId =
    interaction.customId.split("_")[2];

  if (
    interaction.user.id !==
    targetUserId
  ) {
    await interaction.reply({
      content:
        "This offer is not for you.",
      ephemeral: true,
    });

    return;
  }

  // ----------------------------------------------------------
  // DECLINE
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    `flop_decline_${targetUserId}`
  ) {
    await interaction.update({
      components: [
        new ContainerBuilder()
          .setAccentColor(0xef4444)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `<@${targetUserId}> has declined the offer. The staff member will continue talking with them — the ticket will stay open.`
            )
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    return;
  }

  // ----------------------------------------------------------
  // ACCEPT
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    `flop_accept_${targetUserId}`
  ) {
    const member =
      await interaction.guild.members
        .fetch(targetUserId)
        .catch(() => null);

    if (!member) {
      await interaction.reply({
        content:
          "I couldn't find that member in the server.",
        ephemeral: true,
      });

      return;
    }

    try {
      await member.roles.add(
        HITTER_ROLE_ID,
        "Accepted Vanta Central Flop Request"
      );
    } catch (error) {
      console.error(
        "Failed to add Hitter role:",
        error
      );

      await interaction.reply({
        content:
          "I couldn't grant the Hitter role. Make sure my bot role is above that role.",
        ephemeral: true,
      });

      return;
    }

    await interaction.update({
      components: [
        new ContainerBuilder()
          .setAccentColor(0x22c55e)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `<@${targetUserId}> has accepted the opportunity and has been granted access to the necessary channels.\n\n` +
              `Please check the staff channels for further information.\n\n` +
              `This ticket will close in **2 minutes** and a transcript will be saved.`
            )
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    const targetUser = member.user;
    // --------------------------------------------------------
    // DM USER
    // --------------------------------------------------------

    try {
      const dmContainer =
        new ContainerBuilder()
          .setAccentColor(0x8b5cf6)

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "## Quick Question\n\n" +
              `> <@${targetUserId}>, do you want to __learn how to become a hitter?__?\n\n` +
              "-# Click **Yes** or **No** below to indicate your decision."
            )
          )

          .addSeparatorComponents(
            new SeparatorBuilder()
              .setDivider(true)
              .setSpacing(
                SeparatorSpacingSize.Small
              )
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "-# Vanta Central Middleman Service"
            )
          )

          .addActionRowComponents(
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    `flop_dm_yes_${targetUserId}`
                  )
                  .setLabel("Yes")
                  .setStyle(
                    ButtonStyle.Success
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    `flop_dm_no_${targetUserId}`
                  )
                  .setLabel("No")
                  .setStyle(
                    ButtonStyle.Secondary
                  )
              )
          );

      await targetUser.send({
        components: [
          dmContainer,
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      console.log(
        `Could not DM ${targetUser.tag}:`,
        error.message
      );
    }

    // --------------------------------------------------------
    // CLOSE TICKET AFTER 2 MINUTES
    // --------------------------------------------------------

    setTimeout(async () => {
      try {
        if (
          interaction.channel &&
          interaction.channel.isTextBased()
        ) {
          await interaction.channel.send(
            "Closing this ticket and saving the transcript..."
          );

          await closeTicketChannel(interaction.channel, {
            type: "Flop Request",
            closedBy: null,
            reason: "Flop request accepted",
          });
        }
      } catch (error) {
        console.error(
          "Failed to close ticket:",
          error
        );
      }
    }, 2 * 60 * 1000);

    return;
  }
}

// ============================================================
// FLOP — DM YES / NO
// ============================================================

if (
  interaction.isButton() &&
  (
    interaction.customId.startsWith(
      "flop_dm_yes_"
    ) ||
    interaction.customId.startsWith(
      "flop_dm_no_"
    )
  )
) {
  const targetUserId =
    interaction.customId.split("_")[3];

  if (
    interaction.user.id !==
    targetUserId
  ) {
    await interaction.reply({
      content:
        "This message is not for you.",
      ephemeral: true,
    });

    return;
  }

  // ----------------------------------------------------------
  // NO
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    `flop_dm_no_${targetUserId}`
  ) {
    await interaction.update({
      components: [
        new ContainerBuilder()
          .setAccentColor(0x6b7280)
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "## Scam Notification\n\n" +
              "No problem. You can ask staff about hitting again whenever you're interested."
            )
          ),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    return;
  }

  // ----------------------------------------------------------
  // YES
  // ----------------------------------------------------------

  if (
    interaction.customId ===
    `flop_dm_yes_${targetUserId}`
  ) {
    const informationContainer =
      new ContainerBuilder()
        .setAccentColor(0x8b5cf6)

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "## Hitting Information\n\n" +
            "> I'll explain this in a __simple way__ — read everything below.",
            "> Hitting is just another word for scamming\n" +


            "**How do I handle a trade?**\n" +
            "> 1. Join 1–5 SAB trading servers and find trades with people.\n" +
            "> 2. Once a trade is found, ask to use a middleman.\n" +
            "> 3. Invite them to our server. (no link? ask in #staff-chat)\n" +
            "> 4. Open a ticket in #middleman-request.\n" +
            "> 5. The middleman scams them; you keep 100% of your first hit, then 50/50 after.\n\n" 
          )
        )

        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(
              SeparatorSpacingSize.Small
            )
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "-# Click **Script** below for a reference conversation you can use."
          )
        )

        .addActionRowComponents(
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `flop_script_${targetUserId}`
                )
                .setLabel("Script")
                .setStyle(
                  ButtonStyle.Primary
                )
            )
        )

        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(
              SeparatorSpacingSize.Small
            )
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "-# Vanta Central Middleman Service"
          )
        );

    await interaction.update({
      components: [
        informationContainer,
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    return;
  }
}

// ============================================================
// FLOP
// ============================================================

if (
  interaction.isButton() &&
  interaction.customId.startsWith(
    "flop_script_"
  )
) {
  const targetUserId =
    interaction.customId.split("_")[2];

  if (
    interaction.user.id !==
    targetUserId
  ) {
    await interaction.reply({
      content:
        "This  message is not for you.",
      ephemeral: true,
    });

    return;
  }

  const scriptContainer =
    new ContainerBuilder()
      .setAccentColor(0x3b82f6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Reference Script"
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "**He says:** Which middleman can we use for this trade, please?\n\n" +

          "**You say:**\n" +
          "```" +
          "Oh wow, really? That's honestly shocking to hear. Getting scammed by a middleman is a terrible experience." +
          "```\n\n" +

          "**He says:** Yeah, it was.\n\n" +

          "**You say:**\n" +
          "```" +
          "Do you remember which middleman server it was?" +
          "```\n\n" +

          "**He says:** For example, Steak's MM server.\n\n" +

          "**You say:**\n" +
          "```" +
          "Thank you for telling me. I understand why you'd be careful now. Personally, I only use trusted middleman servers with a strong reputation and verified proofs, and I've never had a bad experience so far." +
          "```\n\n" +

          "**He says:** Oh okay.\n\n" +

          "**You say:**\n" +
          "```" +
          "If you ever feel comfortable using a middleman again, I can suggest a reliable server that many traders trust. Of course, it's completely your decision — I just want both of us to be safe during the trade." +
          "```\n\n" +

          "**He says:** Okay, thank you.",
          "**After, invite him to the server: discord.gg/vantacentral**"
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Copy/paste lines if needed."
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      );

  await interaction.update({
    components: [
      scriptContainer,
    ],
    flags: MessageFlags.IsComponentsV2,
  });

  return;
}

    // ============================================================
// MM UNDERSTANDING BUTTONS
// ============================================================

if (
  interaction.isButton() &&
  (
    interaction.customId === "mm_understanding_yes" ||
    interaction.customId === "mm_understanding_no"
  )
) {
  const understands =
    interaction.customId === "mm_understanding_yes";

  const understandingContainer =
    new ContainerBuilder()
      .setAccentColor(
        understands
          ? 0x22c55e
          : 0xef4444
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## MM Understanding"
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "-# USER",
            `<@${interaction.user.id}>`,
            "",
            "-# STATUS",
            understands
              ? "`Understands the process`"
              : "`Still confused — needs assistance`",
            "",
            understands
              ? "-# Cleared to proceed with the trade."
              : "-# A staff member will walk them through the Middleman process.",
          ].join("\n")
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      );

  await interaction.reply({
    components: [
      understandingContainer,
    ],
    flags:
      MessageFlags.IsComponentsV2,
  });

  return;
}
      if (
    interaction.isButton() &&
    [
      "guide_spanish",
      "guide_portuguese_brazil",
      "guide_portuguese_portugal",
      "guide_arabic",
    ].includes(interaction.customId)
  ) {
    const translations = {
      guide_spanish: {
        title: "## Guía | Si eres nuevo en gaming",
        content: [
          "**__¿Qué debo hacer?__**",
"> `・` Debes ir a otros servidores y anunciar los intercambios. Una vez que la otra parte te contacte por mensaje privado (DM),",
"> deberías dirigir la conversación hacia el uso de un intermediario. Cuando acepten, envíales",
"> el enlace de nuestro servidor y abre un ticket en <#1555883985580720231> berás indicar tu",
"> nombre de usuario y el intercambio que ambos van a realizar. Una vez creado el ticket, un",
"> intermediario **aleatorio** acudirá para ayudarte.",
"",
"**__¿Cómo obtengo ganancias?__**",
"> `・` Una vez que tú y el intermediario completen el intercambio, dividirán el valor de la ganancia",
"> al 50% entre ambos. Sin embargo, el intermediario decide qué entregarte",
"> (siempre que sea el 50%)",
"> `・` Ten en cuenta que el **intermediario** decide cómo se hace la división. Siempre que sea justa,",
"> eso es lo que cuenta.",
"",
"**__¿Puedo convertirme en intermediario?__**",
"> `・` Al conseguir 10 operaciones exitosas para nosotros, puedes ascender a intermediario. Todas las pruebas deben",
"> mostrarse en el canal de actividad; de lo contrario, no se otorgará el ascenso.",
"> `・` Al conseguir 5 operaciones exitosas con cuentas alternativas (ALT) para nosotros, puedes ascender a intermediario principal. Todas las pruebas",
"> deben mostrarse en el canal de comandos (cmds); de lo contrario, no se otorgará el ascenso.",
"> `・` Puedes ascender a rangos superiores comprando o consiguiendo operaciones con cuentas alternativas. Los precios y",
"> los requisitos de ascenso figuran en <#1555883749416247398>.",
"",
"**__¿Qué cosas importantes debo recordar?__**",
"> `・` Revisa <#1555883929184112692> de no sufrir un descenso de rango ni recibir advertencias por infringir",
"> dichas normas.",
"> `・` No hagas publicidad por mensajes privados (DM) ni utilices intermediarios personales. Estas infracciones",
"> conllevarán un baneo.",
        ].join("\n"),
      },

      guide_portuguese_brazil: {
        title: "## Guia | Se você é novo em gaming",
        content: [
          "**__O que eu faço?__**",
          "> `・` <#1554170669716086885>",
          "",
          "**__Como eu obtenho lucro?__**",
          "> `・` continue jogando",
          "> `・` tenha isso em mente",
          "",
          "**__Posso me tornar um middleman?__**",
          "> `・` sim",
          "> `・` sim",
          "> `・` <#1555883749416247398>.",
          "",
          "**__Coisas importantes para lembrar?__**",
          "> `・` Verifique <#1555883929184112692> para garantir que você não seja rebaixado ou advertido por quebrá-las.",
          "> `・` não faça isso",
        ].join("\n"),
      },

      guide_portuguese_portugal: {
        title: "## Guia | Se és novo em gaming",
        content: [
          "**__O que faço?__**",
          "> `・` <#1554170669716086885>",
          "",
          "**__Como obtenho lucro?__**",
          "> `・` continua a jogar",
          "> `・` tem isto em mente",
          "",
          "**__Posso tornar-me middleman?__**",
          "> `・` sim",
          "> `・` sim",
          "> `・` <#1555883749416247398>.",
          "",
          "**__Coisas importantes a lembrar?__**",
          "> `・` Consulta <#1555883929184112692> para garantir que não és despromovido ou advertido por as infringir.",
          "> `・` não faças isso",
        ].join("\n"),
      },

      guide_arabic: {
        title: "## الدليل | إذا كنت جديدًا في الألعاب",
        content: [
          "**__ماذا أفعل؟__**",
          "> `・` <#1554170669716086885>",
          "",
          "**__كيف أحصل على الربح؟__**",
          "> `・` استمر في اللعب",
          "> `・` ضع هذا في اعتبارك",
          "",
          "**__هل يمكنني أن أصبح وسيطًا؟__**",
          "> `・` نعم",
          "> `・` نعم",
          "> `・` <#1555883749416247398>.",
          "",
          "**__أشياء مهمة يجب تذكرها؟__**",
          "> `・` تحقق من <#1555883929184112692> للتأكد من أنك لن تتعرض للخفض أو التحذير بسبب مخالفتها.",
          "> `・` لا تفعل ذلك",
        ].join("\n"),
      },
    };

    const translation =
      translations[interaction.customId];

    const divider1 = new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small);

    const guideGif =
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL("attachment://vanta_central_main.gif")
          .setDescription("Vanta Central Guide")
      );

    const translatedContainer =
      new ContainerBuilder()
        .setAccentColor(0x8b5cf6)

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            translation.title
          )
        )

        .addSeparatorComponents(divider1)

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            translation.content
          )
        )

        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small)
        )

        .addMediaGalleryComponents(guideGif)

        .addSeparatorComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small)
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "-# Vanta Central Middleman Service"
          )
        );

    await interaction.reply({
      components: [translatedContainer],
      files: [
        new AttachmentBuilder("./vanta_central_main.gif")
          .setName("vanta_central_main.gif"),
      ],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });

    return;
  }

  // ============================================================
  // REQUEST MIDDLEMAN BUTTON
  // ============================================================

  if (
    interaction.isButton() &&
    interaction.customId === "request_middleman"
  ) {
    const modal = new ModalBuilder()
      .setCustomId("middleman_request_modal")
      .setTitle("Request Middleman");

    const tradeInput = new TextInputBuilder()
      .setCustomId("trade")
      .setLabel("What is the trade?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
  

    const otherUserInput = new TextInputBuilder()
      .setCustomId("other_user")
      .setLabel("Other user (ID, @mention, or username)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)


    const privateServerInput = new TextInputBuilder()
      .setCustomId("private_servers")
      .setLabel("Can you join private servers using links?")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
     

    modal.addComponents(
      new ActionRowBuilder().addComponents(tradeInput),
      new ActionRowBuilder().addComponents(otherUserInput),
      new ActionRowBuilder().addComponents(privateServerInput)
    );

    await interaction.showModal(modal);
    return;
  }

// ============================================================
// REACTION ROLE BUTTONS
// ============================================================

if (interaction.isButton()) {
  const roleMap = {
    reaction_role_giveaway: GIVEAWAY_ROLE_ID,
    reaction_role_updates: UPDATES_ROLE_ID,
    reaction_role_blacklist: BLACKLIST_ROLE_ID,
  };

  const roleId = roleMap[interaction.customId];

  if (roleId) {
    // Acknowledge the interaction immediately so it cannot expire
   await interaction.deferReply({
  flags: MessageFlags.Ephemeral,
});

    try {
      const role =
        await interaction.guild.roles.fetch(roleId);

      if (!role) {
        await interaction.editReply({
          content:
            "That role could not be found.",
        });

        return;
      }

      const member =
        interaction.member;

      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(role);

        await interaction.editReply({
          content:
            `Removed **${role.name}** from you.`,
        });

        return;
      }

      await member.roles.add(role);

      await interaction.editReply({
        content:
          `Added **${role.name}** to you.`,
      });

    } catch (error) {
      console.error(
        "Reaction role error:",
        error
      );

      // The interaction was already acknowledged
      // with deferReply(), so use editReply().
      await interaction.editReply({
        content:
          "I couldn't update your role. Make sure the bot's highest role is above the reaction role.",
      }).catch(() => {});
    }

    return;
  }
}

 // ============================================================
// CLAIM BUTTON
// ============================================================

if (
  interaction.isButton() &&
  interaction.customId === "middleman_claim"
) {
  const ticketState = ticketStates.get(interaction.channel.id);

  if (!ticketState) {
    return interaction.reply({
      content:
        "This ticket's state could not be found. Please contact staff.",
      ephemeral: true,
    });
  }

  // Only middlemen can claim
  // Staff level 1+ can claim
if (
  !hasStaffLevelInteraction(
    interaction,
    1
  )
) {
  return interaction.reply({
    content:
      "You do not have permission to claim tickets.",
    ephemeral: true,
  });
}

  // Already claimed
  if (ticketState.claimerId) {
    return interaction.reply({
      content:
        `This ticket has already been claimed by <@${ticketState.claimerId}>.`,
      ephemeral: true,
    });
  }

  ticketState.claimerId = interaction.user.id;

  await interaction.deferUpdate();

  // DISABLE CLAIM + ADD UNCLAIM
if (ticketState.claimMessageId) {
  try {
    const claimMessage =
      await interaction.channel.messages.fetch(
        ticketState.claimMessageId
      );

    const claimButton =
      new ButtonBuilder()
        .setCustomId("middleman_claim")
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true);

    const unclaimButton =
      new ButtonBuilder()
        .setCustomId("middleman_unclaim")
        .setLabel("Unclaim")
        .setStyle(ButtonStyle.Secondary);

    const closeButton =
      new ButtonBuilder()
        .setCustomId("middleman_close")
        .setLabel("Close")
        .setStyle(ButtonStyle.Danger);

    const buttons =
      new ActionRowBuilder().addComponents(
        claimButton,
        unclaimButton,
        closeButton
      );

    await claimMessage.edit({
      components: [buttons],
    });
  } catch (error) {
    console.error(
      "Failed to update claim buttons:",
      error
    );
  }
}
  // ==========================================================
  // TICKET CLAIMED CONTAINER
  // ==========================================================

  const claimDivider =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  const claimedContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Ticket Claimed"
        )
      )

      .addSeparatorComponents(
        claimDivider
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "-# CLAIMER",
            `<@${interaction.user.id}>`,
            "",
            "-# STATUS",
            "`Active`",
            "",
            "-# Only the claimer can reply in this ticket. **Executive** keeps full oversight.",
          ].join("\n")
        )
      )

      .addSeparatorComponents(
        claimDivider
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman service"
        )
      );

  await interaction.channel.send({
    components: [claimedContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  ticketStates.set(
    interaction.channel.id,
    ticketState
  );

  return;
}

// ============================================================
// UNCLAIM BUTTON
// ============================================================

if (
  interaction.isButton() &&
  interaction.customId === "middleman_unclaim"
) {
  const ticketState = ticketStates.get(interaction.channel.id);

  if (!ticketState) {
    return interaction.reply({
      content:
        "This ticket's state could not be found. Please contact staff.",
      ephemeral: true,
    });
  }

  // Only the current claimer can unclaim
  if (interaction.user.id !== ticketState.claimerId) {
    return interaction.reply({
      content:
        "Only the current claimer can unclaim this ticket.",
      ephemeral: true,
    });
  }

  ticketState.claimerId = null;

  await interaction.deferUpdate();

  // Restore Claim button and remove Unclaim
  if (ticketState.claimMessageId) {
    try {
      const claimMessage =
        await interaction.channel.messages.fetch(
          ticketState.claimMessageId
        );

      const claimButton =
        new ButtonBuilder()
          .setCustomId("middleman_claim")
          .setLabel("Claim")
          .setStyle(ButtonStyle.Success);

      const closeButton =
        new ButtonBuilder()
          .setCustomId("middleman_close")
          .setLabel("Close")
          .setStyle(ButtonStyle.Danger);

      const buttons =
        new ActionRowBuilder().addComponents(
          claimButton,
          closeButton
        );

      await claimMessage.edit({
        components: [buttons],
      });
    } catch (error) {
      console.error(
        "Failed to restore claim buttons:",
        error
      );
    }
  }

  // Tag middlemen first
  await interaction.channel.send({
    content: `<@&${MIDDLEMAN_ROLE_ID}>`,
    allowedMentions: {
      roles: [MIDDLEMAN_ROLE_ID],
    },
  });

  const unclaimDivider =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  const unclaimedContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Ticket Unclaimed"
        )
      )
      .addSeparatorComponents(
        unclaimDivider
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "-# RELEASED BY:",
            `<@${interaction.user.id}>`,
            "",
            "-# STATUS",
            "`Open - Awaiting Claim`",
            "",
            `-# Staff access has been __restored__. <@&${MIDDLEMAN_ROLE_ID}> - this ticket is available to claim.`,
          ].join("\n")
        )
      )
      .addSeparatorComponents(
        unclaimDivider
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central Middleman Service"
        )
      );

  await interaction.channel.send({
    components: [unclaimedContainer],
    flags: MessageFlags.IsComponentsV2,
  });

  ticketStates.set(
    interaction.channel.id,
    ticketState
  );

  return;
}

// ============================================================
// CLOSE BUTTON
// ============================================================

if (
  interaction.isButton() &&
  interaction.customId === "middleman_close"
) {
  // The state only lives in memory, so it is gone after a bot restart.
  // Staff can still close the ticket in that case.
  const ticketState = ticketStates.get(interaction.channel.id);

  const isOwner = interaction.member.roles.cache.has(
    MM_APPLICATION_EXECUTIVE_ROLE_ID
  );

  const isClaimer =
    Boolean(ticketState) &&
    interaction.user.id === ticketState.claimerId;

  const hasStaffAccess = hasStaffLevelInteraction(interaction, 1);

  if (!isClaimer && !isOwner && !hasStaffAccess) {
    return interaction.reply({
      content: ticketState?.claimerId
        ? `Only the claimer (<@${ticketState.claimerId}>) or an owner can close this ticket.`
        : "Only staff can close this ticket.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.reply({
    content: "Saving transcript and closing...",
    flags: MessageFlags.Ephemeral,
  });

  await closeTicketChannel(interaction.channel, {
    type: "Middleman",
    closedBy: interaction.user,
    reason: "Middleman ticket closed",
  });

  return;
}
  // ============================================================
  // CHECKLIST BUTTONS
  // ============================================================

  const checklistButtons = [
    "trade_details",
    "trade_holding",
    "trade_set_fee",
    "trade_fee",
    "trade_payment",
    "trade_delivery",
    "trade_vouch",
    "trade_reset",
  ];

  if (
    interaction.isButton() &&
    checklistButtons.includes(interaction.customId)
  ) {
    const ticketState = ticketStates.get(interaction.channel.id);

    if (!ticketState || !ticketState.claimerId) {
      return interaction.reply({
        content:
          "This ticket has not been claimed yet.",
        ephemeral: true,
      });
    }

    // Only claimer can use checklist
   if (
  !hasStaffLevelInteraction(
    interaction,
    1
  )
) {
  return interaction.reply({
    content:
      "You do not have permission to update the trade checklist.",
    ephemeral: true,
  });
}

if (
  interaction.user.id !==
  ticketState.claimerId
) {
  return interaction.reply({
    content:
      "Only the current claimer can update this ticket.",
    ephemeral: true,
  });
}

    // ==========================================================
    // SET FEE
    // ==========================================================

    if (interaction.customId === "trade_set_fee") {
      const feeModal = new ModalBuilder()
        .setCustomId(`set_fee_modal_${interaction.channel.id}`)
        .setTitle("Set Middleman Fee");

      const feeInput = new TextInputBuilder()
        .setCustomId("fee_amount")
        .setLabel("Middleman Fee Amount")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(
          "e.g. 500 Robux, $5 USD, 5%, Free"
        );

      feeModal.addComponents(
        new ActionRowBuilder().addComponents(feeInput)
      );

      return interaction.showModal(feeModal);
    }

    // ==========================================================
    // FEE PAID
    // ==========================================================

    if (interaction.customId === "trade_fee") {
      if (!ticketState.feeAmount) {
        return interaction.reply({
          content:
            "Please configure the middleman fee first.",
          ephemeral: true,
        });
      }

      ticketState.checklistState.fee = true;

      await updateChecklistMessage(
        interaction.channel,
        ticketState
      );

      await sendChecklistEvent(
        interaction.channel,
        interaction.user,
        "Fee Confirmed",
        [
          "> `・`**Status**: `Paid`",
          `> \`・\`**Details**: ${ticketState.feeAmount}`,
          `> \`・\`**Updated By**: <@${interaction.user.id}>`,
          `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
        ],
        0x57f287
      );

      return interaction.deferUpdate();
    }

    // ==========================================================
    // DETAILS
    // ==========================================================

    if (interaction.customId === "trade_details") {
      ticketState.checklistState.details = true;

      await updateChecklistMessage(
        interaction.channel,
        ticketState
      );

      await sendChecklistEvent(
        interaction.channel,
        interaction.user,
        "Details Confirmed",
        [
          "> `・`**Status**: `Confirmed`",
          `> \`・\`**Updated By**: <@${interaction.user.id}>`,
          `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
        ],
        0x57f287
      );

      return interaction.deferUpdate();
    }

    // ==========================================================
    // HOLDING
    // ==========================================================

    if (interaction.customId === "trade_holding") {
      ticketState.checklistState.holding = true;

      await updateChecklistMessage(
        interaction.channel,
        ticketState
      );

      await sendChecklistEvent(
        interaction.channel,
        interaction.user,
        "Holding Secured",
        [
          "> `・`**Status**: `Secured (MM Holding)`",
          `> \`・\`**Updated By**: <@${interaction.user.id}>`,
          `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
        ],
        0x57f287
      );

      return interaction.deferUpdate();
    }

    // ==========================================================
    // PAYMENT
    // ==========================================================

    if (interaction.customId === "trade_payment") {
      ticketState.checklistState.payment = true;

      await updateChecklistMessage(
        interaction.channel,
        ticketState
      );

      await sendChecklistEvent(
        interaction.channel,
        interaction.user,
        "Payment Confirmed",
        [
          "> `・`**Status**: `Sent`",
          `> \`・\`**Updated By**: <@${interaction.user.id}>`,
          `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
        ],
        0x57f287
      );

      return interaction.deferUpdate();
    }

    // ==========================================================
    // DELIVERY
    // ==========================================================

    if (interaction.customId === "trade_delivery") {
      ticketState.checklistState.delivery = true;

      await updateChecklistMessage(
        interaction.channel,
        ticketState
      );

      await sendChecklistEvent(
        interaction.channel,
        interaction.user,
        "Delivery Confirmed",
        [
          "> `・`**Status**: `Done`",
          `> \`・\`**Updated By**: <@${interaction.user.id}>`,
          `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
        ],
        0x57f287
      );

      return interaction.deferUpdate();
    }

    // ==========================================================
    // VOUCH
    // ==========================================================

    if (interaction.customId === "trade_vouch") {
      ticketState.checklistState.vouch = true;

      await updateChecklistMessage(
        interaction.channel,
        ticketState
      );

      await sendChecklistEvent(
        interaction.channel,
        interaction.user,
        "Vouch Confirmed",
        [
          "> `・`**Status**: `Completed`",
          `> \`・\`**Updated By**: <@${interaction.user.id}>`,
          `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
        ],
        0x57f287
      );

      return interaction.deferUpdate();
    }

    // ==========================================================
    // RESET
    // ==========================================================

    if (interaction.customId === "trade_reset") {
      ticketState.checklistState = {
        details: false,
        holding: false,
        fee: false,
        payment: false,
        delivery: false,
        vouch: false,
      };

      ticketState.feeAmount = null;

      await updateChecklistMessage(
        interaction.channel,
        ticketState
      );

      await sendChecklistEvent(
        interaction.channel,
        interaction.user,
        "Checklist Reset",
        [
          "> `・`**Status**: `All milestones reset to pending`",
          `> \`・\`**Updated By**: <@${interaction.user.id}>`,
          `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
        ],
        0xed4245
      );

      return interaction.deferUpdate();
    }
  }


  // ============================================================
  // FEE MODAL
  // ============================================================

  if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith("set_fee_modal_")
  ) {
    const ticketState = ticketStates.get(interaction.channel.id);

    if (!ticketState || !ticketState.claimerId) {
      return interaction.reply({
        content:
          "This ticket has not been claimed yet.",
        ephemeral: true,
      });
    }

   if (
  !hasStaffLevelInteraction(
    interaction,
    1
  )
) {
  return interaction.reply({
    content:
      "You do not have permission to configure the middleman fee.",
    ephemeral: true,
  });
}

if (
  interaction.user.id !==
  ticketState.claimerId
) {
  return interaction.reply({
    content:
      "Only the current claimer can configure the middleman fee.",
    ephemeral: true,
  });
}

    const feeAmount =
      interaction.fields.getTextInputValue("fee_amount");

    ticketState.feeAmount = feeAmount;

   await interaction.deferUpdate();

    await sendChecklistEvent(
      interaction.channel,
      interaction.user,
      "Fee Configured",
      [
        "> `・`**Status**: `Amount Set`",
        `> \`・\`**Details**: ${feeAmount}`,
        `> \`・\`**Updated By**: <@${interaction.user.id}>`,
        `> \`・\`**Time**: ${formatReceiptDate(new Date())}`,
      ],
      0x57f287
    );

    return;
  }

  // ============================================================
  // MIDDLEMAN MODAL SUBMISSION
  // ============================================================

  if (
    interaction.isModalSubmit() &&
    interaction.customId === "middleman_request_modal"
  ) {
    await interaction.deferReply({
  flags: MessageFlags.Ephemeral,
});

    try {
      const trade =
        interaction.fields.getTextInputValue("trade");

      const otherUser =
        interaction.fields.getTextInputValue("other_user");

      const privateServers =
        interaction.fields.getTextInputValue("private_servers");

      const category =
        await interaction.guild.channels.fetch(
          MM_TICKET_CATEGORY_ID
        );

      if (!category) {
        return interaction.editReply({
          content:
            "The Middleman ticket category could not be found.",
        });
      }

      const ticketChannel =
        await interaction.guild.channels.create({
          name: `mm-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: MM_TICKET_CATEGORY_ID,

          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ["ViewChannel"],
            },
            {
              id: interaction.user.id,
              allow: [
                "ViewChannel",
                "SendMessages",
                "ReadMessageHistory",
                "AttachFiles",
              ],
            },
            {
  id: MIDDLEMAN_ROLE_ID,
  allow: [
    "ViewChannel",
    "SendMessages",
    "ReadMessageHistory",
    "AttachFiles",
  ],
},
            {
              id: client.user.id,
              allow: [
                "ViewChannel",
                "SendMessages",
                "ReadMessageHistory",
                "ManageChannels",
                "ManageMessages",
              ],
            },
          ],
        });

      registerTicketMeta(ticketChannel.id, "Middleman", interaction.user.id);

      // ========================================================
      // TICKET PING
      // ========================================================

      await ticketChannel.send({
        content:
          `<@&${MIDDLEMAN_ROLE_ID}> <@${interaction.user.id}>`,
        allowedMentions: {
          roles: [MIDDLEMAN_ROLE_ID],
          users: [interaction.user.id],
        },
      });

      // ========================================================
      // MIDDLEMAN REQUEST CONTAINER
      // ========================================================

      const ticketDivider = new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(SeparatorSpacingSize.Small);

      const ticketGif =
        new AttachmentBuilder(RULES_GIF_PATH).setName(
          "vanta_central_main.gif"
        );

      const ticketTitle = new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            "## Vanta Central | Middleman Request"
          )
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder()
            .setURL("attachment://vanta_central_thumbnail.gif")
            .setDescription(
              "Vanta Central Middleman"
            )
        );

      // YOUR EXISTING TEXT — UNCHANGED
      const ticketRequestText =
        new TextDisplayBuilder().setContent(
          [
            "> A new middleman request has been created. Please wait for staff to claim this ticket.",
            "",
            "-# REQUESTER",
            `<@${interaction.user.id}>`,
            "",
            "-# OTHER PARTY",
            `\`${trade}\``,
            "",
            "-# TRADE DETAILS",
            `\`${otherUser}\``,
            "",
            "-# CAN JOIN LINKS",
            `\`${privateServers}\``,
          ].join("\n")
        );

      const ticketRequestFooter =
        new TextDisplayBuilder().setContent(
          "-# A middleman will be with you shortly."
        );

      const ticketGifGallery =
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder()
            .setURL(
              "attachment://vanta_central_main.gif"
            )
            .setDescription("Vanta Central")
        );

      const claimCloseButtons =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("middleman_claim")
            .setLabel("Claim")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("middleman_close")
            .setLabel("Close")
            .setStyle(ButtonStyle.Danger)
        );

      const ticketContainer =
        new ContainerBuilder()
          .setAccentColor(0x8b5cf6)

          .addSectionComponents(ticketTitle)

          .addSeparatorComponents(ticketDivider)

          .addTextDisplayComponents(
            ticketRequestText
          )

          .addTextDisplayComponents(
            ticketRequestFooter
          )

          .addSeparatorComponents(ticketDivider)

          .addMediaGalleryComponents(
            ticketGifGallery
          )

          .addSeparatorComponents(ticketDivider)

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "-# Vanta Central Middleman Service"
            )
          );

      // FIRST CONTAINER
      const ticketMessage =
        await ticketChannel.send({
          components: [ticketContainer],
          files: [ticketGif],
          flags: MessageFlags.IsComponentsV2,
        });

     // CLAIM/CLOSE OUTSIDE FIRST CONTAINER
const claimMessage = await ticketChannel.send({
  components: [claimCloseButtons],
});

      // ========================================================
      // CHECKLIST
      // ========================================================

      const checklistGif =
        new AttachmentBuilder(
          RULES_GIF_PATH
        ).setName("vanta_central_main.gif");

      const checklistTitle =
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "## Vanta Central | Trade Checklist"
            )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder()
              .setURL(
                "attachment://vanta_central_main.gif"
              )
              .setDescription(
                "Vanta Central Trade Checklist"
              )
          );

      const checklistButtonsRow1 =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("trade_details")
            .setLabel("Details")
            .setStyle(
              ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId("trade_holding")
            .setLabel("Holding")
            .setStyle(
              ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId("trade_set_fee")
            .setLabel("Set Fee")
            .setStyle(
              ButtonStyle.Primary
            ),

          new ButtonBuilder()
            .setCustomId("trade_fee")
            .setLabel("Fee")
            .setStyle(
              ButtonStyle.Secondary
            )
        );

      const checklistButtonsRow2 =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("trade_payment")
            .setLabel("Payment")
            .setStyle(
              ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId("trade_delivery")
            .setLabel("Delivery")
            .setStyle(
              ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId("trade_vouch")
            .setLabel("Vouch")
            .setStyle(
              ButtonStyle.Secondary
            ),

          new ButtonBuilder()
            .setCustomId("trade_reset")
            .setLabel("Reset")
            .setStyle(
              ButtonStyle.Danger
            )
        );

      const checklistContainer =
        new ContainerBuilder()
          .setAccentColor(0x8b5cf6)

          .addSectionComponents(
            checklistTitle
          )

          .addSeparatorComponents(
            ticketDivider
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              [
                "**Trade Progress & Verification**",
                "Track and verify each step of the trade below.",
                "> `・`**Details:** `Pending`",
                "> `・`**Holding:** `Pending`",
                "> `・`**Fee:** `Not Set` (Unpaid)",
                "> `・`**Payment:** `Pending`",
                "> `・`**Delivery:** `Pending`",
                "> `・`**Vouch:** `Pending`",
                "",
                "*Click the buttons below to update trade milestones in real time.*",
              ].join("\n")
            )
          )

          .addSeparatorComponents(
            ticketDivider
          )

          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              "-# Vanta Central MM Verification"
            )
          )

          // 8 BUTTONS INSIDE CONTAINER
          .addActionRowComponents(
            checklistButtonsRow1
          )
          .addActionRowComponents(
            checklistButtonsRow2
          );

      const checklistMessage =
        await ticketChannel.send({
          components: [
            checklistContainer,
          ],
          files: [checklistGif],
          flags:
            MessageFlags.IsComponentsV2,
        });

      // ========================================================
      // SAVE STATE
      // ========================================================

      ticketStates.set(
  ticketChannel.id,
  {
    requesterId:
      interaction.user.id,

    claimerId: null,

    claimMessageId:
      claimMessage.id,

    feeAmount: null,

    requestMessage:
      ticketMessage,

    requestContainer:
      ticketContainer,

    checklistMessageId:
      checklistMessage.id,

    checklistState: {
      details: false,
      holding: false,
      fee: false,
      payment: false,
      delivery: false,
      vouch: false,
    },

    inactivityHeld: false,

    lastActivity: Date.now(),

    escrowTimerUntil: null,

    escrowTimerTimeout: null,
  }

);
startTicketInactivityTimer(
  ticketChannel
);

      await interaction.editReply({
        content:
          `Your Middleman ticket has been created: ${ticketChannel}`,
      });

      console.log(
        `Middleman ticket created: ${ticketChannel.name}`
      );

    } catch (error) {
      console.error(
        "Middleman ticket creation error:",
        error
      );

      await interaction.editReply({
        content:
          "Something went wrong while creating your Middleman ticket.",
      });
    }
  }
});
// ============================================================
// RECEIPT CONTAINER
// ============================================================

function buildReceiptContainer(
  receipt,
  verifiedView = false
) {
  const divider =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  const registrationText =
    verifiedView
      ? "-# Verified Vanta Central Trade Receipt"
      : "*This receipt was officially registered in the Cupid Central trade registry. Save the Receipt ID for reference.*";

  return new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "## Official Trade Receipt"
      )
    )

    .addSeparatorComponents(
      divider
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `> \`・\` **Receipt ID:** \`${receipt.id}\``,
          `> \`・\` **Middleman:** <@${receipt.middlemanId}>`,
          `> \`・\` **Buyer:** <@${receipt.buyerId}>`,
          `> \`・\` **Seller:** <@${receipt.sellerId}>`,
          `> \`・\` **Date:** ${formatReceiptDate(receipt.timestamp)} (<t:${Math.floor(receipt.timestamp / 1000)}:R>)`,
          "",
          "**Trade Summary:**",
          "```",
          receipt.trade,
          "```",
          "",
          registrationText,
        ].join("\n")
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(
          SeparatorSpacingSize.Small
        )
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "-# Vanta Central MM Services"
      )
    );
}
// ============================================================
// CHECKLIST MESSAGE UPDATER
// ============================================================

async function updateChecklistMessage(
  channel,
  ticketState
) {
  const message =
    await channel.messages.fetch(
      ticketState.checklistMessageId
    );

  const state =
    ticketState.checklistState;

  const row1 =
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("trade_details")
        .setLabel(
          state.details
            ? "Details: Confirmed"
            : "Details"
        )
        .setStyle(
          state.details
            ? ButtonStyle.Success
            : ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId("trade_holding")
        .setLabel(
          state.holding
            ? "Holding: Secured"
            : "Holding"
        )
        .setStyle(
          state.holding
            ? ButtonStyle.Success
            : ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId("trade_set_fee")
        .setLabel("Set Fee")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("trade_fee")
        .setLabel(
          state.fee
            ? "Fee: Paid"
            : "Fee"
        )
        .setStyle(
          state.fee
            ? ButtonStyle.Success
            : ButtonStyle.Secondary
        )
    );

  const row2 =
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("trade_payment")
        .setLabel(
          state.payment
            ? "Payment: Sent"
            : "Payment"
        )
        .setStyle(
          state.payment
            ? ButtonStyle.Success
            : ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId("trade_delivery")
        .setLabel(
          state.delivery
            ? "Delivery: Done"
            : "Delivery"
        )
        .setStyle(
          state.delivery
            ? ButtonStyle.Success
            : ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId("trade_vouch")
        .setLabel(
          state.vouch
            ? "Vouch: Done"
            : "Vouch"
        )
        .setStyle(
          state.vouch
            ? ButtonStyle.Success
            : ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId("trade_reset")
        .setLabel("Reset")
        .setStyle(ButtonStyle.Danger)
    );

  const checklistTitle =
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Vanta Central | Trade Checklist"
        )
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL(
            "attachment://vanta_central_main.gif"
          )
          .setDescription(
            "Vanta Central Trade Checklist"
          )
      );

  const divider1 =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  const divider2 =
    new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(
        SeparatorSpacingSize.Small
      );

  const feeDisplay =
    state.fee
      ? "Paid"
      : "Not Set";

  const checklistContainer =
    new ContainerBuilder()
      .setAccentColor(0x8b5cf6)

      .addSectionComponents(
        checklistTitle
      )

      .addSeparatorComponents(
        divider1
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "**Trade Progress & Verification**",
            "Track and verify each step of the trade below.",
            `> \`・\`**Details:** \`${state.details ? "Confirmed" : "Pending"}\``,
            `> \`・\`**Holding:** \`${state.holding ? "Secured (MM Holding)" : "Pending"}\``,
            `> \`・\`**Fee:** \`${feeDisplay}\` ${state.fee ? "" : "(Unpaid)"}`,
            `> \`・\`**Payment:** \`${state.payment ? "Sent" : "Pending"}\``,
            `> \`・\`**Delivery:** \`${state.delivery ? "Done" : "Pending"}\``,
            `> \`・\`**Vouch:** \`${state.vouch ? "Completed" : "Pending"}\``,
            "",
            "*Click the buttons below to update trade milestones in real time.*",
          ].join("\n")
        )
      )

      .addSeparatorComponents(
        divider2
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central MM Verification"
        )
      )

      .addActionRowComponents(row1)
      .addActionRowComponents(row2);

  await message.edit({
    components: [
      checklistContainer,
    ],
  });
}
// ============================================================
// CHECKLIST EVENT CONTAINER
// ============================================================

async function sendChecklistEvent(
  channel,
  user,
  title,
  lines,
  accentColor
) {
  const avatar =
    user.displayAvatarURL({
      extension: "png",
      size: 128,
    });

  const titleSection =
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `## ${title}`
        )
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL(avatar)
          .setDescription(
            `${user.username}'s avatar`
          )
      );

  const container =
    new ContainerBuilder()
      .setAccentColor(accentColor)

      .addSectionComponents(
        titleSection
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          lines.join("\n")
        )
      )

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
          .setSpacing(
            SeparatorSpacingSize.Small
          )
      )

      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "-# Vanta Central MM Verification"
        )
      );

await channel.send({
  components: [container],
  flags: MessageFlags.IsComponentsV2,
});
    

}
// ============================================================
// TEST VERIFIED VOUCH TICKER
// ============================================================

const TEST_TRADE_TYPES = [
  "Ingame",
  "Ingame",
  "Ingame",
  "Ingame",
  "Ingame",
  "Apple Pay",
  "Cashapp",
  "Paypal",
  "Crypto",
  "LTC",
  "Zelle",
  "Gift Cards",
  "Robux",
  "Nitro",
];


function getRandomItem(array) {
  return array[
    Math.floor(Math.random() * array.length)
  ];
}

function getRandomVouchDelay() {
  // 10–20 minutes
  return (
    (10 * 60 * 1000) +
    Math.floor(
      Math.random() *
      (10 * 60 * 1000)
    )
  );
}

async function sendTestVerifiedVouch() {
  try {
    const channel =
      await client.channels.fetch(
        TEST_VOUCH_CHANNEL_ID
      );

    if (
      !channel ||
      !channel.isTextBased()
    ) {
      console.error(
        "vouch channel could not be found."
      );
      return;
    }

    const guild =
      channel.guild;

    if (!guild) {
      console.error(
        "vouch channel is not inside a guild."
      );
      return;
    }

    await guild.members.fetch();

    const allMembers =
      [...guild.members.cache.values()]
        .filter(
          (member) =>
            !member.user.bot
        );

    const middlemen =
      allMembers.filter(
        (member) =>
          member.roles.cache.has(
            TEST_VOUCH_MM_ROLE_ID
          )
      );

    if (allMembers.length < 3) {
      console.error(
        "Not enough members for vouch."
      );
      return;
    }

    if (middlemen.length === 0) {
      console.error(
        "No member with the Middleman role was found."
      );
      return;
    }

    // --------------------------------------------------------
    // PICK RANDOM USERS
    // --------------------------------------------------------

    const mm =
      getRandomItem(middlemen);

    const availableUsers =
      allMembers.filter(
        (member) =>
          member.id !== mm.id
      );

    if (availableUsers.length < 2) {
      console.error(
        "Not enough users besides the middleman."
      );
      return;
    }

    const shuffled =
      [...availableUsers].sort(
        () => Math.random() - 0.5
      );

    const seller =
      shuffled[0];

    const buyer =
      shuffled[1];

    // --------------------------------------------------------
    // RANDOM TEST DATA
    // -------------------------------------------------------
        const tradeType = getRandomItem(TEST_TRADE_TYPES);
       

    const divider = new SeparatorBuilder()
      .setDivider(true)
      .setSpacing(SeparatorSpacingSize.Small);

  // --------------------------------------------------------
// VERIFIED VOUCH TEST CONTAINER
// --------------------------------------------------------

const feedbackStars = Math.random() < 0.85 ? 5 : 4;

const feedbackText = [
  "-# FEEDBACK",
  `> ${"⭐".repeat(feedbackStars)}ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ`,
].join("\n");

const vouchContainer =
  new ContainerBuilder()
    .setAccentColor(0x8b5cf6)

    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          "<:verified:1555884253273661461> **Verified Vouch**"
        )
    )

    .addSeparatorComponents(
      divider
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          [
            "-# TRADE TYPE",
            `\`${tradeType}\``,
            "",
            "-# USERS",
            `**Seller:** <@${seller.id}>`,
            `**Buyer:** <@${buyer.id}>`,
            `**MM:** <@${mm.id}>`,
          ].join("\n")
        )
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(feedbackText)
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(
          SeparatorSpacingSize.Small
        )
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          "-# Vanta Central Middleman Service"
        )
    );

    // --------------------------------------------------------
    // TAG 3 PEOPLE
    // Last person is ALWAYS the MM
    // --------------------------------------------------------

    await channel.send({
      content:
        `<@${seller.id}> <@${buyer.id}> <@${mm.id}>`,
      allowedMentions: {
        users: [
          seller.id,
          buyer.id,
          mm.id,
        ],
      },
    });

    await channel.send({
      components: [
        vouchContainer,
      ],
      flags:
        MessageFlags.IsComponentsV2,
    });

    console.log(
      `Seller: ${seller.user.tag} | Buyer: ${buyer.user.tag} | MM: ${mm.user.tag} | Type: ${tradeType}`
    );

  } catch (error) {
    console.error(
      "verified vouch error:",
      error
    );
  }
}

function scheduleNextTestVouch() {
  const delay = getRandomVouchDelay();

  setTimeout(async () => {
    await sendTestVerifiedVouch();

    scheduleNextTestVouch();
  }, delay);
}

// ============================================================
// TEST TRADE COMPLETED TICKER
// ============================================================


const TEST_COINS = [
  {
    id: "btc",
    name: "BTC",
    emoji: "<:btc:1555899312305737820>",
    weight: 12,
    price: 65000,
  },
  {
    id: "eth",
    name: "ETH",
    emoji: "<:ethereum:1555899320958722048>",
    weight: 6,
    price: 2500,
  },
  {
    id: "ltc",
    name: "LTC",
    emoji: "<:ltc:1555899328625774703>",
    weight: 44,
    price: 100,
  },
  {
    id: "sol",
    name: "SOL",
    emoji: "<:solana:1555899336515395645>",
    weight: 11,
    price: 150,
  },
  {
    id: "usdtbsc",
    name: "USDT BSCP",
    displayName: "USDT BSCP (BEP-20)",
    emoji: "<:usdtbsc:1555899344312467486>",
    weight: 22,
    price: 1,
  },
  {
    id: "usdteth",
    name: "USDT",
    displayName: "USDT - Ethereum (ERC20)",
    emoji: "<:usdteth:1555899352487305267>",
    weight: 1,
    price: 1,
  },
  {
    id: "usdtsol",
    name: "USDT",
    displayName: "USDT - Solana (SOL)",
    emoji: "<:usdtsol:1555899360796213318>",
    weight: 1,
    price: 1,
  },
  {
    id: "usdceth",
    name: "USDC",
    displayName: "USDC - Ethereum (ERC20)",
    emoji: "<:usdceth:1555899368924647486>",
    weight: 1,
    price: 1,
  },
  {
    id: "usdcsol",
    name: "USDC",
    displayName: "USDC - Solana (SOL)",
    emoji: "<:usdcsol:1555899376147103785>",
    weight: 1,
    price: 1,
  },
];

function pickWeightedTradeCoin() {
  const totalWeight = TEST_COINS.reduce(
    (sum, coin) => sum + coin.weight,
    0
  );

  let random = Math.random() * totalWeight;

  for (const coin of TEST_COINS) {
    random -= coin.weight;

    if (random <= 0) {
      return coin;
    }
  }

  return TEST_COINS[2];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function generateTradeUsdAmount() {
  const roll = Math.random() * 100;

  // 31%: $0–5
  if (roll < 31) {
    return randomBetween(0.50, 5);
  }

  // 22%: $5–25
  if (roll < 53) {
    return randomBetween(5, 25);
  }

  // 39%: $25–100
  if (roll < 92) {
    return randomBetween(25, 100);
  }

  // 8%: $100+
  return randomBetween(100, 500);
}

function formatCryptoAmount(amount, coin) {
  if (coin.id === "usdtbsc") {
    return amount.toFixed(2);
  }

  if (
    coin.id === "usdteth" ||
    coin.id === "usdtsol" ||
    coin.id === "usdceth" ||
    coin.id === "usdcsol"
  ) {
    return amount.toFixed(2);
  }

  if (coin.id === "btc") {
    return amount.toFixed(8);
  }

  if (coin.id === "eth") {
    return amount.toFixed(6);
  }

  if (coin.id === "ltc") {
    return amount.toFixed(5);
  }

  if (coin.id === "sol") {
    return amount.toFixed(4);
  }

  return amount.toFixed(6);
}

function generateDemoTransactionId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  function randomPart(length) {
    let result = "";

    for (let i = 0; i < length; i++) {
      result +=
        chars[Math.floor(Math.random() * chars.length)];
    }

    return result;
  }

  return `${randomPart(9)}...${randomPart(9)}`;
}

function getTradeDelay() {
  // 3–7 minutes
  return (
    3 * 60 * 1000 +
    Math.random() * (4 * 60 * 1000)
  );
}

async function sendTestTradeCompleted() {
  try {
    const channel =
      await client.channels.fetch(
        TEST_TRADE_CHANNEL_ID
      );

    if (
      !channel ||
      !channel.isTextBased()
    ) {
      console.error(
        " Channel not found."
      );
      return;
    }

    const coin =
      pickWeightedTradeCoin();

    const usdAmount =
      generateTradeUsdAmount();

    const cryptoAmount =
      usdAmount / coin.price;

    const formattedCrypto =
      formatCryptoAmount(
        cryptoAmount,
        coin
      );

    const formattedUsd =
      usdAmount.toFixed(2);

    const transactionId =
      generateDemoTransactionId();

    const coinDisplayName =
      coin.displayName || coin.name;

    const divider =
      new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(
          SeparatorSpacingSize.Small
        );

    const container =
      new ContainerBuilder()
        .setAccentColor(0x8b5cf6)

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              `${coin.emoji} **Trade Completed**`
            )
        )

        .addSeparatorComponents(
          divider
        )

        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              [
                `**\`${formattedCrypto}\` ${coinDisplayName}** \`($${formattedUsd} USD)\``,
                "",
                `<:Arrow:1555884377282453534> **Sender**`,
                "`[Anonymous]`",
                "",
                `<:Arrow:1555884377282453534> **Receiver**`,
                "`[Anonymous]`",
                "",
                `<:Arrow:1555884377282453534> **Transaction ID**`,
                "```",
                `${transactionId}`,
                "```",
              ].join("\n")
            )
        )

    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });

    console.log(
      ` ${coinDisplayName} | $${formattedUsd} | ${formattedCrypto} ${coin.name} | ${transactionId}`
    );
  } catch (error) {
    console.error(
      "Error:",
      error
    );
  }
}

function scheduleNextTestTrade() {
  const delay =
    getTradeDelay();

  console.log(
    `Next trade in ${Math.round(
      delay / 1000
    )} seconds.`
  );

  setTimeout(async () => {
    await sendTestTradeCompleted();

    scheduleNextTestTrade();
  }, delay);
}

// Start test trade ticker
client.once("ready", async () => {
  console.log(
    " Trade ticker started."
  );
const rankChannel = await client.channels.fetch("1555883749416247398");

if (rankChannel && rankChannel.isTextBased()) {
  await sendRankInfoMessage(rankChannel);
}
  // First test message after 10 seconds
  setTimeout(async () => {
    await sendTestTradeCompleted();

    scheduleNextTestTrade();
  }, 10000);
});
  // First verified vouch after 15 seconds, then every 10-20 minutes
  setTimeout(async () => {
    await sendTestVerifiedVouch();

    scheduleNextTestVouch();
  }, 15000);
// ============================================================
// TRADING TERMS OF SERVICE — ONE-TIME MESSAGE
// ============================================================

function loadTradingTosState() {
  return loadJsonFile(TRADING_TOS_STATE_FILE, {
    posted: false,
    messageId: null,
  });
}

function saveTradingTosState(state) {
  saveJsonFile(TRADING_TOS_STATE_FILE, state);
}

async function sendTradingTosOnce() {
  try {
    const state = loadTradingTosState();

    // Already posted previously
    if (state.posted) {
      console.log(
        "[TRADING TOS] Already posted. Skipping."
      );
      return;
    }

    const channel = await client.channels.fetch(
      TRADING_TOS_CHANNEL_ID
    );

    if (
      !channel ||
      !channel.isTextBased()
    ) {
      console.error(
        "[TRADING TOS] Channel not found."
      );
      return;
    }

   const tosContainer = new ContainerBuilder()
  .setAccentColor(0x8B5CF6)

  // TOP: title + small GIF on the right
  .addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent("## Trading Terms of Service\n## Please Read & Follow All Rules")
      )
      .setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL("attachment://vanta_central_thumbnail.gif")
      )
  )

  // Divider
  .addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
  )

  // Rules
  .addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent(`> These terms keep our marketplace **safe, fair, and scam-free** for everyone.
> Trading in our server means you __agree__ to abide by every rule listed below.

### 1 · Cross-Trading
> Cross-trading is **only allowed** with __server-approved Middlemen__.
> Violations result in a warning. *(3 warnings = mute)*

### 2 · Prohibited Statements
> Phrases such as **"mm of my choice"** or **"ngf"** are not allowed during cross-trading.
> Violations result in warnings. *(3 warnings = mute, further violations = ban)*

### 3 · Trading Locations
> Cross-trading is permitted **only** in <#1555884009450377237>.
> Roblox-related trading is permitted **only** in <#1555884009450377237>.

### 4 · Middleman Violations
> Suggesting a **scam Middleman** or refusing to use a trusted Middleman results in an __instant ban__.
> Spotted someone breaking this rule? **Report them immediately** in <#1555884056271396915>.

### 5 · Illegal Trading
> Trading illegal items is strictly prohibited and results in an __instant ban__.
> This includes **Discord Nitro**, **accounts**, **scripts**, **cheats**, or anything that violates Discord's Terms of Service.

### 6 · Middleman Usage
> Always use a Middleman for every cross-trade and follow our **Middleman TOS** (\`.mmtos\`).
> Request a Middleman in <#1555883979285209139>.

### 7 · Respectful Trading
> Be **kind** and **respectful** to all traders, especially new ones.
> Rude or toxic behavior may lead to warnings or bans.

-# Trading in this server constitutes acceptance of these terms.`)
  )

  // Divider
  .addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
  )

  // Bottom GIF
  .addMediaGalleryComponents(
    new MediaGalleryBuilder()
      .addItems(
        new MediaGalleryItemBuilder()
          .setURL("attachment://vanta_central_main.gif")
      )
  )

  // Divider
  .addSeparatorComponents(
    new SeparatorBuilder()
      .setSpacing(SeparatorSpacingSize.Small)
  )

  // Footer
  .addTextDisplayComponents(
    new TextDisplayBuilder()
      .setContent("-# Vanta Central Middleman Service")
  );

    const message =
      await channel.send({
        files: [
          new AttachmentBuilder(
            AWARENESS_GIF_PATH,
            {
              name:
                "vanta_central_thumbnail.gif",
            }
          ),
          new AttachmentBuilder(
            RULES_GIF_PATH,
            {
              name:
                "vanta_central_main.gif",
            }
          ),
        ],
        components: [
          tosContainer,
        ],
        flags:
          MessageFlags.IsComponentsV2,
      });

    saveTradingTosState({
      posted: true,
      messageId: message.id,
      postedAt: Date.now(),
    });

    console.log(
      `[TRADING TOS] Posted successfully: ${message.id}`
    );

  } catch (error) {
    console.error(
      "[TRADING TOS] Error:",
      error
    );
  }
}

async function sendTraderVerificationOnce() {
  try {
    // Check whether the message was already posted
    if (fs.existsSync(TRADER_VERIFICATION_STATE_FILE)) {
      const state = JSON.parse(
        fs.readFileSync(TRADER_VERIFICATION_STATE_FILE, "utf8")
      );

      if (state.posted === true) {
        console.log(
          "[TRADER VERIFICATION] Message already exists. Skipping."
        );
        return;
      }
    }

    const channel = await client.channels.fetch(
      TRADER_VERIFICATION_CHANNEL_ID
    );

    if (!channel || !channel.isTextBased()) {
      console.error(
        "[TRADER VERIFICATION] Channel not found or is not text-based."
      );
      return;
    }

    const container = new ContainerBuilder()
      .setAccentColor(0x8B5CF6)

      // Top title + small GIF on the right
      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder()
              .setContent("## Vanta Central | Trader Verification")
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder()
              .setURL("attachment://vanta_central_thumbnail.gif")
          )
      )

      // Divider
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      // Main content
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`To maintain a **safe, secure, and trusted** trading environment,
**Vanta Central** operates an official **Trader Verification Program**
for members participating in trades.

━━━━━━━━━━━━━━━━━━

# __Verified Trader__

The **Verified Trader** role is granted to members who complete the
verification process and provide proof of ownership for the items,
accounts, or assets they intend to trade.

**Verification Requirements**
> • Contact a **Support Manager or higher**
> • Provide valid proof of ownership
> • Submit required verification materials
> • Complete staff review

Once approved, you will receive the **Verified Trader** role.

━━━━━━━━━━━━━━━━━━

# __Trusted Trader__

The **Trusted Trader** role is reserved for members who have
established a strong reputation through **safe and legitimate**
**trading activity.**

**Requirements**
> • Successful trading history
> • Positive community reputation
> • Use of official marketplace services
> • Following all marketplace rules
> • Management approval

Trusted Trader status is awarded after a review of trading activity.

━━━━━━━━━━━━━━━━━━

# __Why Verification Matters__

> • Builds trust between traders
> • Reduces potential scam risks
> • Promotes safer transactions
> • Maintains a reliable marketplace

━━━━━━━━━━━━━━━━━━

> All verification decisions are handled exclusively by **Vanta Central** Management and are final.

# Vanta Central`)
      )

      // Divider
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      // Bottom GIF
      .addMediaGalleryComponents(
        new MediaGalleryBuilder()
          .addItems(
            new MediaGalleryItemBuilder()
              .setURL("attachment://vanta_central_main.gif")
          )
      );

    const message = await channel.send({
      components: [container],
      files: [
        new AttachmentBuilder(TRADER_VERIFICATION_GIF_PATH, {
          name: "vanta_central_thumbnail.gif",
        }),
        new AttachmentBuilder(TRADER_VERIFICATION_BOTTOM_GIF_PATH, {
          name: "vanta_central_main.gif",
        }),
      ],
      flags: MessageFlags.IsComponentsV2,
    });

    // Save state so it never reposts after restart
    fs.writeFileSync(
      TRADER_VERIFICATION_STATE_FILE,
      JSON.stringify(
        {
          posted: true,
          messageId: message.id,
          postedAt: Date.now(),
        },
        null,
        2
      )
    );

    console.log(
      "[TRADER VERIFICATION] Message posted successfully."
    );
  } catch (error) {
    console.error(
      "[TRADER VERIFICATION] Error:",
      error
    );
  }
}
function loadSupportPanelState() {
  return loadJsonFile(SUPPORT_PANEL_STATE_FILE, { posted: false });
}

function saveSupportPanelState(data) {
  saveJsonFile(SUPPORT_PANEL_STATE_FILE, data);
}

async function sendSupportPanelOnce() {
  try {
    const state = loadSupportPanelState();

    if (state.posted) {
      console.log(
        "[SUPPORT PANEL] Message already exists. Skipping."
      );
      return;
    }

    const channel = await client.channels.fetch(
      SUPPORT_PANEL_CHANNEL_ID
    );

    if (!channel || !channel.isTextBased()) {
      console.error(
        "[SUPPORT PANEL] Channel not found or is not text-based."
      );
      return;
    }

    const container = new ContainerBuilder()
      .setAccentColor(0x8B5CF6)

      // ========================================================
      // TITLE + TOP RIGHT GIF
      // ========================================================

      .addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder()
              .setContent(
                "## <:Arrow:1555884377282453534> Vanta Central | Support Panel"
              )
          )
          .setThumbnailAccessory(
            new ThumbnailBuilder()
              .setURL(
                "attachment://vanta_central_thumbnail.gif"
              )
          )
      )

      // ========================================================
      // APPLY FOR MIDDLEMAN
      // ========================================================

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**<:MemberIcon:1555899399354196039> Apply for Middleman**

Apply only if you meet the requirements below. When applying you must provide video proof; screenshots are not accepted. Pinging staff about your application will result in it being rejected.

**Requirements:** minimum **250+ vouches**, proven past middleman experience, and verifiable collateral. Screen-recorded video proof required.`)
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("mm_application_start")
        .setLabel("Apply For Middleman")
        .setStyle(ButtonStyle.Primary)
    )
)

      // ========================================================
      // SUPPORT TICKET
      // ========================================================

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**<:whitephonelogominimal:1555899414864859257> Open Support Ticket**

For any issue with the server, your account, payments, or general questions. A staff member will pick it up.`)
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("support_ticket_start")
        .setLabel("Support Ticket")
        .setStyle(ButtonStyle.Primary)
    )
)

      // ========================================================
      // REPORT USER
      // ========================================================

      .addSeparatorComponents(
        new SeparatorBuilder()
          .setSpacing(SeparatorSpacingSize.Small)
      )

      .addSectionComponents(
  new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`**<:MapArrow:1555899407155855450> Report User**

Flag a member as a Scammer, DWC, or Timewaster. You'll pick the user, choose a category, and submit a reason.`)
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("report_user_start")
        .setLabel("Report User")
        .setStyle(ButtonStyle.Danger)
    )
)

    const message = await channel.send({
      components: [container],

      files: [
        new AttachmentBuilder(
          SUPPORT_PANEL_GIF_PATH,
          {
            name: "vanta_central_thumbnail.gif",
          }
        ),
      ],

      flags: MessageFlags.IsComponentsV2,
    });

    saveSupportPanelState({
      posted: true,
      messageId: message.id,
      postedAt: Date.now(),
    });

    console.log(
      "[SUPPORT PANEL] Message posted successfully."
    );

  } catch (error) {
    console.error(
      "[SUPPORT PANEL] Error:",
      error
    );
  }
}



client.on("guildMemberAdd", async (member) => {
  try {
    await member.roles.add(AUTO_ROLE_ID);
    console.log(`Assigned auto role to ${member.user.tag}`);
  } catch (error) {
    console.error(`Failed to assign auto role to ${member.user.tag}:`, error);
  }
});
// ================================
// ERROR HANDLING + LOGIN
// ================================

// Without these, one failed request crashes the whole bot and every
// in-memory ticket state is lost on the restart.
process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error);
});

client.on("error", (error) => {
  console.error("[CLIENT ERROR]", error);
});

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is missing. Add it to your .env file.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);