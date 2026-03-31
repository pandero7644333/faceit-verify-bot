const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const axios = require("axios");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// 🔥 ROLE MAP (WSTAW ID RÓL)
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

// pamięć kodów
const pending = new Map();

// extract nick
function extractNickname(url) {
  const match = url.match(/players\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// slash command rejestracja
const commands = [
  new SlashCommandBuilder()
    .setName("verify")
    .setDescription("FACEIT verify")
    .addSubcommand(sub =>
      sub
        .setName("faceit")
        .setDescription("Verify FACEIT account")
        .addStringOption(opt =>
          opt.setName("link")
            .setDescription("FACEIT profile link")
            .setRequired(true)
        )
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.once("ready", async () => {
  console.log(`✅ Logged as ${client.user.tag}`);

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error(err);
  }
});

// interaction
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (
    interaction.commandName === "verify" &&
    interaction.options.getSubcommand() === "faceit"
  ) {
    const url = interaction.options.getString("link");
    const userId = interaction.user.id;

    const nick = extractNickname(url);

    if (!nick) {
      return interaction.reply("❌ Zły link FACEIT");
    }

    const existing = pending.get(userId);

    // 1. generate code
    if (!existing) {
      const code = Math.floor(1000000000 + Math.random() * 9000000000).toString();

      pending.set(userId, { code, nick });

      return interaction.reply(
        `🔐 Wklej ten kod do BIO FACEIT:\n\n**${code}**\n\nNastępnie wpisz /verify faceit jeszcze raz.`
      );
    }

    // 2. verify
    const { code } = existing;

    try {
      const res = await axios.get(
        `https://open.faceit.com/data/v4/players?nickname=${nick}`,
        {
          headers: { Authorization: `Bearer ${process.env.FACEIT_KEY}` }
        }
      );

      const playerId = res.data.player_id;

      const profile = await axios.get(
        `https://open.faceit.com/data/v4/players/${playerId}`,
        {
          headers: { Authorization: `Bearer ${process.env.FACEIT_KEY}` }
        }
      );

      const bio = profile.data.about || "";
      const level = profile.data.games?.cs2?.skill_level;

      if (!bio.includes(code)) {
        return interaction.reply("❌ Kod nie znaleziony w BIO FACEIT");
      }

      const roleId = roleMap[level];

      if (!roleId) {
        return interaction.reply("❌ Brak roli dla tego levela");
      }

      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) {
        return interaction.reply("❌ Nie znaleziono roli");
      }

      await interaction.member.roles.add(role);

      pending.delete(userId);

      return interaction.reply(`✅ Zweryfikowano! FACEIT level: ${level}`);

    } catch (err) {
      console.error(err);
      return interaction.reply("❌ Błąd FACEIT API");
    }
  }
});

client.login(process.env.TOKEN);
