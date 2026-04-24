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

app.get("/", (req, res) => {
  res.send("Bot Online ✅");
});

app.get("/dashboard", (req, res) => {
  res.send(`
    <h1>Public Dashboard</h1>
    <p>Applications: ${db.applications.length}</p>
    <p>Warns: ${db.warns.length}</p>
    <p>Blacklist: ${db.blacklist.length}</p>
    <p>Troll: ${db.troll.length}</p>
  `);
});

app.listen(config.port, () => {
  console.log(`Dashboard running on port ${config.port}`);
});

// ================= DISCORD CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: ["CHANNEL"]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ================= APPLICATION QUESTIONS =================
const questions = [
  "Why do you want this role?",
  "Do you have experience?",
  "How active are you?"
];

// ================= BUTTON SYSTEM =================
client.on("interactionCreate", async (i) => {

  // OPEN PANEL
  if (i.isButton() && i.customId === "open_apply") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("hr").setLabel("HR").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("partner").setLabel("Partner").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("mod").setLabel("Moderator").setStyle(ButtonStyle.Danger)
    );

    return i.reply({
      content: "📩 Choose a role:",
      components: [row],
      ephemeral: true
    });
  }

  // ROLE SELECT
  if (["hr", "partner", "mod"].includes(i.customId)) {
    return startApplication(i, i.customId);
  }

  // ACCEPT APPLICATION
  if (i.isButton() && i.customId.startsWith("accept_")) {
    const id = i.customId.split("_")[1];
    const app = db.applications.find(a => a.id === id);

    if (!app) return i.reply({ content: "Not found", ephemeral: true });

    await i.reply(`🟢 Accepted <@${app.user}> for **${app.role}**`);
    return;
  }

  // DENY APPLICATION
  if (i.isButton() && i.customId.startsWith("deny_")) {
    const id = i.customId.split("_")[1];
    const app = db.applications.find(a => a.id === id);

    if (!app) return i.reply({ content: "Not found", ephemeral: true });

    await i.reply(`🔴 Denied <@${app.user}> for **${app.role}**`);
    return;
  }
});

// ================= APPLICATION SYSTEM (DM) =================
async function startApplication(i, roleKey) {
  const roles = {
    hr: "HR",
    partner: "Partnership Manager",
    mod: "Moderator"
  };

  const role = roles[roleKey];
  const user = i.user;

  try {
    await user.send(`📩 Starting **${role}** application`);

    const answers = [];

    for (let q of questions) {
      await user.send(q);

      const collected = await user.dmChannel.awaitMessages({
        filter: m => m.author.id === user.id,
        max: 1,
        time: 300000
      });

      answers.push(collected.first()?.content || "No answer");
    }

    const id = Date.now().toString();

    const appData = {
      id,
      user: user.id,
      role,
      answers,
      time: Date.now()
    };

    db.applications.push(appData);
    saveDB();

    // SEND TO STAFF CHANNEL
    const channel = await client.channels.fetch(db.config.applicationChannel);

    const embed = new EmbedBuilder()
      .setTitle("📩 New Application")
      .setDescription(`User: <@${user.id}>\nRole: ${role}`)
      .setColor("Blue")
      .setFooter({ text: `ID: ${id}` });

    questions.forEach((q, index) => {
      embed.addFields({
        name: q,
        value: answers[index] || "None"
      });
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_${id}`)
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`deny_${id}`)
        .setLabel("Deny")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return i.reply({ content: "📩 Check your DMs!", ephemeral: true });

  } catch {
    return i.reply({ content: "❌ Enable DMs.", ephemeral: true });
  }
}

// ================= PANEL COMMAND =================
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Open application panel")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.mainGuildId),
    { body: commands }
  );

  console.log("Commands registered");
})();

// ================= PANEL HANDLER =================
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "panel") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_apply")
        .setLabel("Apply Now")
        .setStyle(ButtonStyle.Primary)
    );

    return i.reply({
      content: "🚀 Staff Applications",
      components: [row]
    });
  }
});

client.login(config.token);