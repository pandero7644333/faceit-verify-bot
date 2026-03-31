const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const axios = require("axios");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// 🔥 TWOJE ROLE
const roleMap = {
  1: "1488562516668973066",
  2: "1488562786240827392",
  3: "1488562754670428461",
  4: "1488562731559686248",
  5: "1488562709158039696",
  6: "1488562683816054874",
  7: "1488562659334029373",
  8: "1488562634738634773",
  9: "1488562579931398306",
  10: "1488562554237354076"
};

const pending = new Map();

function extractNickname(url) {
  const match = url.match(/players\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// 🔥 ZMIENIONA NAZWA KOMENDY (żeby odświeżyć)
const commands = [
  new SlashCommandBuilder()
    .setName("verify2")
    .setDescription("FACEIT verify")
    .addSubcommand(sub =>
      sub
        .setName("faceit")
        .setDescription("Verify FACEIT")
        .addStringOption(opt =>
          opt.setName("link")
            .setDescription("FACEIT link")
            .setRequired(true)
        )
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// ✅ READY
client.once("ready", async () => {
  console.log(`✅ Logged as ${client.user.tag}`);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("✅ Commands updated");
});

// 💬 INTERACTIONS
client.on("interactionCreate", async (interaction) => {

  // SLASH
  if (interaction.isChatInputCommand()) {

    if (
      interaction.commandName === "verify2" &&
      interaction.options.getSubcommand() === "faceit"
    ) {
      const url = interaction.options.getString("link");
      const userId = interaction.user.id;

      const nick = extractNickname(url);

      if (!nick) {
        return interaction.reply({ content: "❌ Zły link", ephemeral: true });
      }

      const code = Math.floor(
        1000000000 + Math.random() * 9000000000
      ).toString();

      pending.set(userId, { code, nick });

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("verify_btn")
          .setLabel("🔎 Sprawdź")
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({
        content:
          `🔐 Wklej ten kod do bio profilu FACEIT:\n\n**${code}**\n\nKliknij przycisk po wklejeniu.`,
        components: [button],
        ephemeral: true
      });
    }
  }

  // BUTTON
  if (interaction.isButton()) {

    if (interaction.customId !== "verify_btn") return;

    const userId = interaction.user.id;
    const data = pending.get(userId);

    if (!data) {
      return interaction.reply({
        content: "❌ Brak weryfikacji",
        ephemeral: true
      });
    }

    const { code, nick } = data;

    try {
      const res = await axios.get(
        `https://open.faceit.com/data/v4/players?nickname=${nick}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FACEIT_KEY}`
          }
        }
      );

      const playerId = res.data.player_id;

      const profile = await axios.get(
        `https://open.faceit.com/data/v4/players/${playerId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FACEIT_KEY}`
          }
        }
      );

      const bio = profile.data.about || "";
      const level = profile.data.games?.cs2?.skill_level;

      if (!bio.includes(code)) {
        return interaction.reply({
          content: "❌ Kod nie znaleziony (poczekaj chwilę)",
          ephemeral: true
        });
      }

      const roleId = roleMap[level];

      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) {
        return interaction.reply({
          content: "❌ Brak roli",
          ephemeral: true
        });
      }

      await interaction.member.roles.add(role);

      pending.delete(userId);

      return interaction.reply({
        content: `✅ Zweryfikowano! Level: ${level}`,
        ephemeral: true
      });

    } catch (err) {
      console.error(err);
      return interaction.reply({
        content: "❌ API error",
        ephemeral: true
      });
    }
  }
});

client.login(process.env.TOKEN);
