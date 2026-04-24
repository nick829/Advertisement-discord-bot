const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  PermissionsBitField
} = require("discord.js");

const express = require("express");
const fs = require("fs");

// ================= CONFIG =================
const config = {
  token: "YOUR_BOT_TOKEN",
  clientId: "YOUR_CLIENT_ID",
  mainGuildId: "MAIN_SERVER_ID",
  staffGuildId: "STAFF_SERVER_ID",
  port: 3000
};

// ================= DB =================
let db = require("./db.json");

function saveDB() {
  fs.writeFileSync("./db.json", JSON.stringify(db, null, 2));
}

// ================= EXPRESS DASHBOARD =================
const app = express();

app.get("/", (req, res) => res.send("Bot Online ✅"));

app.get("/dashboard", (req, res) => {
  res.send(`
    <h1>Staff System</h1>
    <p>Applications: ${db.applications.length}</p>
    <p>Warns: ${db.warns.length}</p>
    <p>Blacklist: ${db.blacklist.length}</p>
    <p>Troll: ${db.troll.length}</p>
    <p>Money Users: ${Object.keys(db.money).length}</p>
  `);
});

app.listen(config.port, () => console.log("Dashboard running"));

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: ["CHANNEL"]
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = await client.guilds.fetch(config.staffGuildId);
  await setupLogs(guild);
});

// ================= ROLE HIERARCHY =================
function canUseStaff(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.roles.highest.position >= db.config.minStaffPosition
  );
}

// ================= LOG SYSTEM =================
async function setupLogs(guild) {

  let category = guild.channels.cache.find(c => c.name === "SERVER LOGS");

  if (!category) {
    category = await guild.channels.create({
      name: "SERVER LOGS",
      type: 4
    });
  }

  const channels = [
    "verification-s2-logs",
    "requests",
    "break-requests",
    "resignations",
    "blacklists",
    "mass-bans",
    "mass-blacklist",
    "lvl-up",
    "tests",
    "money-logs",
    "join-and-leave"
  ];

  for (const name of channels) {
    const exists = guild.channels.cache.find(c => c.name === name);

    if (!exists) {
      await guild.channels.create({
        name,
        type: 0,
        parent: category.id
      });
    }
  }

  console.log("📁 Logs ready");
}

// ================= HELPERS =================
async function giveRole(guildId, userId, roleId) {
  const guild = await client.guilds.fetch(guildId);
  const member = await guild.members.fetch(userId);
  if (member && roleId) await member.roles.add(roleId);
}

async function removeRoles(guildId, userId, roles) {
  const guild = await client.guilds.fetch(guildId);
  const member = await guild.members.fetch(userId);

  for (const r of roles) {
    if (member.roles.cache.has(r)) {
      await member.roles.remove(r);
    }
  }
}

// ================= QUESTIONS =================
const questions = [
  "Why do you want this role?",
  "Do you have experience?",
  "How active are you?"
];

async function ask(user, q) {
  await user.send(q);

  const collected = await user.dmChannel.awaitMessages({
    filter: m => m.author.id === user.id,
    max: 1,
    time: 300000
  });

  return collected.first()?.content || "No answer";
}

// ================= INTERACTIONS =================
client.on("interactionCreate", async (i) => {

  const guild = await client.guilds.fetch(config.staffGuildId);

  // PANEL
  if (i.isButton() && i.customId === "open_apply") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("hr").setLabel("HR").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("partner").setLabel("Partner").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("mod").setLabel("Mod").setStyle(ButtonStyle.Danger)
    );

    return i.reply({ content: "📩 Choose role", components: [row], ephemeral: true });
  }

  if (["hr", "partner", "mod"].includes(i.customId)) {
    return startApp(i, i.customId);
  }

  // ACCEPT
  if (i.isButton() && i.customId.startsWith("accept_")) {
    const id = i.customId.split("_")[1];
    const app = db.applications.find(a => a.id === id);

    if (!app) return i.reply({ ephemeral: true, content: "Not found" });

    await giveRole(config.mainGuildId, app.user, db.config.staffRoles[0]);

    try {
      const u = await client.users.fetch(app.user);
      await u.send("🟢 ACCEPTED");
    } catch {}

    return i.reply("Accepted");
  }

  // DENY
  if (i.isButton() && i.customId.startsWith("deny_")) {
    const id = i.customId.split("_")[1];
    const app = db.applications.find(a => a.id === id);

    try {
      const u = await client.users.fetch(app.user);
      await u.send("🔴 DENIED");
    } catch {}

    return i.reply("Denied");
  }

  // RESIGN ACCEPT
  if (i.isButton() && i.customId.startsWith("resign_")) {
    const userId = i.customId.split("_")[1];

    await removeRoles(config.mainGuildId, userId, db.config.staffRoles);

    const staff = await guild.members.fetch(userId);
    if (staff) await staff.kick("Resigned");

    return i.reply("Resignation accepted");
  }

  // FIRE
  if (i.isChatInputCommand() && i.commandName === "fire") {

    if (!canUseStaff(i.member))
      return i.reply({ content: "No permission", ephemeral: true });

    const user = i.options.getUser("user");
    const reason = i.options.getString("reason");

    await user.send(`❌ Fired: ${reason}`);

    await removeRoles(config.mainGuildId, user.id, db.config.staffRoles);

    const staff = await guild.members.fetch(user.id);
    if (staff) await staff.kick("Fired");

    return i.reply(`Fired ${user.tag}`);
  }

  // PANEL
  if (i.isChatInputCommand() && i.commandName === "panel") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_apply")
        .setLabel("Apply")
        .setStyle(ButtonStyle.Primary)
    );

    return i.reply({ content: "Panel", components: [row] });
  }
});

// ================= APPLICATION =================
async function startApp(i, roleKey) {

  const roles = {
    hr: "HR",
    partner: "Partner",
    mod: "Mod"
  };

  try {
    await i.user.send("Starting application...");

    const answers = [];

    for (const q of questions) {
      answers.push(await ask(i.user, q));
    }

    const id = Date.now().toString();

    db.applications.push({
      id,
      user: i.user.id,
      role: roles[roleKey],
      answers
    });

    saveDB();

    const channel = await client.channels.fetch(db.config.applicationChannel);

    const embed = new EmbedBuilder()
      .setTitle("Application")
      .setDescription(`<@${i.user.id}>`);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`accept_${id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`deny_${id}`).setLabel("Deny").setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return i.reply({ content: "Check DMs", ephemeral: true });

  } catch {
    return i.reply({ content: "Enable DMs", ephemeral: true });
  }
}

// ================= COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Open panel"),

  new SlashCommandBuilder()
    .setName("fire")
    .setDescription("Fire staff")
    .addUserOption(o => o.setName("user").setRequired(true))
    .addStringOption(o => o.setName("reason"))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.mainGuildId),
    { body: commands }
  );

  console.log("Commands loaded");
})();

client.login(config.token);