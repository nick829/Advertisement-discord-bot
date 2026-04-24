const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
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
    <h1>Staff System Dashboard</h1>
    <p>Applications: ${db.applications.length}</p>
    <p>Warns: ${db.warns.length}</p>
    <p>Blacklist: ${db.blacklist.length}</p>
    <p>Troll: ${db.troll.length}</p>
    <p>Resigns: ${db.resigns.length}</p>
  `);
});

app.listen(config.port, () => {
  console.log(`Dashboard running on ${config.port}`);
});

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: ["CHANNEL"]
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // CREATE LOG CATEGORY
  const guild = await client.guilds.fetch(config.staffGuildId);

  let category = guild.channels.cache.find(c => c.name === "SERVER LOGS");

  if (!category) {
    await guild.channels.create({
      name: "SERVER LOGS",
      type: 4
    });
  }

  console.log("Logs category ready");
});

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

function isStaff(member) {
  return db.config.staffRoles?.some(r => member.roles.cache.has(r));
}

// ================= QUESTIONS =================
const questions = [
  "Why do you want this role?",
  "Do you have experience?",
  "How active are you?"
];

// ================= DM ASK =================
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

  // PANEL OPEN
  if (i.isButton() && i.customId === "open_apply") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("hr").setLabel("HR").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("partner").setLabel("Partner").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("mod").setLabel("Moderator").setStyle(ButtonStyle.Danger)
    );

    return i.reply({ content: "📩 Choose role:", components: [row], ephemeral: true });
  }

  // ROLE SELECT
  if (["hr", "partner", "mod"].includes(i.customId)) {
    return startApplication(i, i.customId);
  }

  // ACCEPT
  if (i.isButton() && i.customId.startsWith("accept_")) {
    const id = i.customId.split("_")[1];
    const app = db.applications.find(a => a.id === id);

    if (!app) return i.reply({ content: "Not found", ephemeral: true });

    // GIVE ROLE
    await giveRole(config.mainGuildId, app.user, db.config.traineeRole);

    // DM USER
    try {
      const user = await client.users.fetch(app.user);
      await user.send(`🟢 You were ACCEPTED for **${app.role}**`);
    } catch {}

    return i.reply(`🟢 Accepted <@${app.user}>`);
  }

  // DENY
  if (i.isButton() && i.customId.startsWith("deny_")) {
    const id = i.customId.split("_")[1];
    const app = db.applications.find(a => a.id === id);

    if (!app) return i.reply({ content: "Not found", ephemeral: true });

    try {
      const user = await client.users.fetch(app.user);
      await user.send(`🔴 You were DENIED for **${app.role}**`);
    } catch {}

    return i.reply(`🔴 Denied <@${app.user}>`);
  }

  // RESIGN ACCEPT
  if (i.isButton() && i.customId.startsWith("resign_accept_")) {
    const userId = i.customId.split("_")[2];

    await removeRoles(config.mainGuildId, userId, db.config.staffRoles);

    const staffGuild = await client.guilds.fetch(config.staffGuildId);
    const member = await staffGuild.members.fetch(userId);
    await member.kick("Resigned");

    return i.reply("🚪 Resignation approved and user removed.");
  }

  // RESIGN COMMAND
  if (i.isChatInputCommand() && i.commandName === "resign") {
    const reason = i.options.getString("reason");

    const data = {
      user: i.user.id,
      reason,
      time: Date.now()
    };

    db.resigns.push(data);
    saveDB();

    const channel = await client.channels.fetch(db.config.resignChannel);

    const msg = await channel.send(
      `📩 RESIGN REQUEST\nUser: <@${i.user.id}>\nReason: ${reason}`
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`resign_accept_${i.user.id}`)
        .setLabel("Accept Resign")
        .setStyle(ButtonStyle.Danger)
    );

    await msg.edit({ components: [row] });

    return i.reply({ content: "📩 Sent", ephemeral: true });
  }

  // PANEL COMMAND
  if (i.isChatInputCommand() && i.commandName === "panel") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_apply")
        .setLabel("Apply Now")
        .setStyle(ButtonStyle.Primary)
    );

    return i.reply({ content: "🚀 Applications Open", components: [row] });
  }
});

// ================= APPLICATION FLOW =================
async function startApplication(i, roleKey) {
  const roles = {
    hr: "HR",
    partner: "Partnership Manager",
    mod: "Moderator"
  };

  const role = roles[roleKey];

  try {
    await i.user.send(`📩 Starting **${role}** application`);

    const answers = [];

    for (let q of questions) {
      answers.push(await ask(i.user, q));
    }

    const id = Date.now().toString();

    const app = {
      id,
      user: i.user.id,
      role,
      answers,
      time: Date.now()
    };

    db.applications.push(app);
    saveDB();

    const channel = await client.channels.fetch(db.config.applicationChannel);

    const embed = new EmbedBuilder()
      .setTitle("📩 New Application")
      .setDescription(`User: <@${i.user.id}>\nRole: ${role}`)
      .setColor("Blue")
      .setFooter({ text: `ID: ${id}` });

    questions.forEach((q, index) => {
      embed.addFields({ name: q, value: answers[index] });
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`accept_${id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`deny_${id}`).setLabel("Deny").setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return i.reply({ content: "📩 Check DMs", ephemeral: true });

  } catch {
    return i.reply({ content: "❌ Enable DMs", ephemeral: true });
  }
}

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Open panel"),

  new SlashCommandBuilder()
    .setName("resign")
    .addStringOption(o => o.setName("reason").setRequired(true))
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