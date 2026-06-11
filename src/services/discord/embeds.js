import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

const SEEK_BRAND_COLOR = 0xef8600;
const SEEK_CARD_FOOTER = "FIFO AUS x SEEK";
const LINKEDIN_BRAND_COLOR = 0x0a66c2;
const LINKEDIN_CARD_FOOTER = "FIFO AUS x LinkedIn";
const NEWS_BRAND_COLOR = 0x16a34a;
const NEWS_CARD_FOOTER = "FIFO AUS mining news";

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}

function createJobEmbed(job, { color, footer, fallbackSummary }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(job.title)
    .setURL(job.url)
    .setDescription(
      truncate(
        job.summary || fallbackSummary,
        300
      )
    )
    .setFooter({
      text: `${footer}${job.listedAt ? ` • Listed ${job.listedAt}` : ""}`
    });

  const fields = [
    { name: "Company", value: job.company || "Not listed", inline: true },
    { name: "Location", value: job.location || "Not listed", inline: true },
    { name: "Work Type", value: job.workType || "Not listed", inline: true }
  ];

  if (job.salary) {
    fields.push({ name: "Salary", value: job.salary, inline: true });
  }

  if (job.matchedKeywords?.length) {
    fields.push({
      name: "Matched",
      value: truncate(job.matchedKeywords.join(", "), 1024),
      inline: true
    });
  }

  if (job.highlights?.length) {
    fields.push({
      name: "Highlights",
      value: truncate(job.highlights.map((item) => `• ${item}`).join("\n"), 1024),
      inline: false
    });
  }

  embed.addFields(fields);

  return embed;
}

export function createSeekJobEmbed(job) {
  return createJobEmbed(job, {
    color: SEEK_BRAND_COLOR,
    footer: SEEK_CARD_FOOTER,
    fallbackSummary: "Fresh FIFO opportunity from SEEK. Use the button below to open the job."
  });
}

export function createSeekJobRow(job) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Open Job").setStyle(ButtonStyle.Link).setURL(job.url)
  );
}

export function createLinkedInJobEmbed(job) {
  return createJobEmbed(job, {
    color: LINKEDIN_BRAND_COLOR,
    footer: LINKEDIN_CARD_FOOTER,
    fallbackSummary: "Fresh FIFO opportunity from LinkedIn. Use the button below to open the job."
  });
}

export function createLinkedInJobRow(job) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Open Job").setStyle(ButtonStyle.Link).setURL(job.url)
  );
}

function formatNewsDate(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "Australia/Perth"
  }).format(date);
}

function formatSourceLabel(value) {
  if (!value) return "Mining news";
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function createNewsEmbed(item) {
  const embed = new EmbedBuilder()
    .setColor(NEWS_BRAND_COLOR)
    .setAuthor({
      name: `${item.publisher || formatSourceLabel(item.source)}`
    })
    .setTitle(truncate(item.title, 256))
    .setURL(item.url)
    .setDescription(
      truncate(
        item.summary || "Fresh mining and resources update. Use the button below to read the full story.",
        420
      )
    )
    .addFields([
      {
        name: "Source",
        value: formatSourceLabel(item.source),
        inline: true
      },
      {
        name: "Published",
        value: formatNewsDate(item.publishedAt),
        inline: true
      },
      {
        name: "Matched",
        value: item.matchedKeywords?.length
          ? truncate(item.matchedKeywords.slice(0, 8).join(", "), 1024)
          : "Mining",
        inline: true
      }
    ])
    .setFooter({ text: NEWS_CARD_FOOTER });

  if (item.tags?.length) {
    embed.addFields({
      name: "Topics",
      value: truncate(item.tags.slice(0, 6).join(", "), 1024),
      inline: false
    });
  }

  return embed;
}

export function createNewsRow(item) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Read Story").setStyle(ButtonStyle.Link).setURL(item.url)
  );
}

export function createInviteButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("invite:create")
      .setLabel("Generate Invite Link")
      .setStyle(ButtonStyle.Primary)
  );
}

export function createSubscribeButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("subscribe:create")
      .setLabel("Subscribe")
      .setStyle(ButtonStyle.Primary)
  );
}

export function getPostMessageConfig(kind) {
  if (kind === "invite") {
    return {
      modalId: "post-invite:modal",
      title: "Premium Access Links",
      footer: "Admin-only access link workflow",
      defaultBody:
        "Use the button below to generate a secure one-time access link for an existing mentorship subscriber.",
      confirmLabel: "invite"
    };
  }

  return {
    modalId: "post-subscribe:modal",
    title: "Join FIFO AUS Premium",
    footer: "Secure Stripe checkout with automatic Discord access",
    defaultBody:
      "Start your subscription below to unlock the premium Discord role and member-only mentorship access.",
    confirmLabel: "subscribe"
  };
}

export function createPostMessageEmbed({ kind, body }) {
  const cfgForKind = getPostMessageConfig(kind);
  return new EmbedBuilder()
    .setColor(SEEK_BRAND_COLOR)
    .setTitle(cfgForKind.title)
    .setDescription(body || cfgForKind.defaultBody)
    .setFooter({ text: cfgForKind.footer });
}

export function createPostMessagePayload({ kind, body }) {
  const row = kind === "invite" ? createInviteButtonRow() : createSubscribeButtonRow();
  return {
    content: "",
    embeds: [createPostMessageEmbed({ kind, body })],
    components: [row]
  };
}

export function createPostMessageModal(kind) {
  const cfgForKind = getPostMessageConfig(kind);
  const messageIdInput = new TextInputBuilder()
    .setCustomId("message_id")
    .setLabel("Message ID to edit (optional)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder("Leave blank to post a new message");
  const messageBodyInput = new TextInputBuilder()
    .setCustomId("message_body")
    .setLabel("Message body")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(4000)
    .setPlaceholder(cfgForKind.defaultBody);

  return new ModalBuilder()
    .setCustomId(cfgForKind.modalId)
    .setTitle(cfgForKind.title)
    .addComponents(
      new ActionRowBuilder().addComponents(messageIdInput),
      new ActionRowBuilder().addComponents(messageBodyInput)
    );
}
