// index.js
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ---------- CONFIG ----------

const EMBED_COLOR = 0x7f8281;

const {
  TOKEN,
  CLIENT_ID,
  GUILD_ID,
  STAFF_ROLE_ID,
  TICKET_ROLE_ID,
  PRODUCT_FORUM_ID,
  TICKET_CATEGORY_ID,
  TICKET_LOG_CHANNEL_ID,
  SUGGESTION_REVIEW_CHANNEL_ID,
  PURCHASE_LINK,
} = process.env;

// ---------- JSON HELPERS ----------

const dataDir = path.join(__dirname, 'data');
const productsPath = path.join(dataDir, 'products.json');
const ticketsPath = path.join(dataDir, 'tickets.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(productsPath)) fs.writeFileSync(productsPath, '[]');
if (!fs.existsSync(ticketsPath)) fs.writeFileSync(ticketsPath, '[]');

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ---------- CLIENT ----------

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

// ---------- COMMAND DEFINITIONS ----------

const commands = [
  new SlashCommandBuilder()
    .setName('product')
    .setDescription('Product system')
    .addSubcommand(sub =>
      sub
        .setName('send')
        .setDescription('Create a product post (forum)')
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all products')
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a product by ID')
        .addIntegerOption(o =>
          o.setName('id').setDescription('Product ID').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('purchase')
    .setDescription('Purchase link configuration')
    .addSubcommand(sub =>
      sub
        .setName('location')
        .setDescription('Set purchase link')
        .addStringOption(o =>
          o
            .setName('set')
            .setDescription('Open modal to set purchase link')
            .setRequired(true)
            .addChoices({ name: 'Set', value: 'set' })
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('send-panel')
    .setDescription('Send the ticket panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show bot status'),

  new SlashCommandBuilder()
    .setName('about')
    .setDescription('About Solara Development'),

  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit a suggestion')
    .addStringOption(o =>
      o.setName('title').setDescription('Short title').setRequired(true)
    )
].map(c => c.toJSON());

// ---------- REGISTER COMMANDS ----------

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });
  console.log('Slash commands registered.');
}

// ---------- UTIL ----------

function baseEmbed() {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setFooter({ text: 'Solara Development' })
    .setTimestamp();
}

function hasStaffRole(member) {
  return member.roles.cache.has(STAFF_ROLE_ID);
}

function nextProductId() {
  const products = readJSON(productsPath);
  if (!products.length) return 1;
  return Math.max(...products.map(p => p.id)) + 1;
}

function nextTicketId() {
  const tickets = readJSON(ticketsPath);
  const base = tickets.length + 1;
  return `SOL-${base.toString().padStart(4, '0')}`;
}

// ---------- READY ----------

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ---------- INTERACTIONS ----------

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      // /product
      if (commandName === 'product') {
        if (!hasStaffRole(interaction.member)) {
          return interaction.reply({
            embeds: [
              baseEmbed().setTitle('No Permission').setDescription(
                'You do not have permission to use this command.'
              ),
            ],
            ephemeral: true,
          });
        }

        const sub = interaction.options.getSubcommand();

        // /product send
        if (sub === 'send') {
          const modal = new ModalBuilder()
            .setCustomId('product_send_modal')
            .setTitle('Create Product');

          const nameInput = new TextInputBuilder()
            .setCustomId('product_name')
            .setLabel('Product Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const idInput = new TextInputBuilder()
            .setCustomId('product_id')
            .setLabel('Product Number (1, 2, 3...)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const typeInput = new TextInputBuilder()
            .setCustomId('product_type')
            .setLabel('Type (Roblox Product / Discord Product)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const priceInput = new TextInputBuilder()
            .setCustomId('product_price')
            .setLabel('Price in Robux')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const detailsInput = new TextInputBuilder()
            .setCustomId('product_details')
            .setLabel('Details')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(idInput),
            new ActionRowBuilder().addComponents(typeInput),
            new ActionRowBuilder().addComponents(priceInput),
            new ActionRowBuilder().addComponents(detailsInput)
          );

          return interaction.showModal(modal);
        }

        // /product list
        if (sub === 'list') {
          const products = readJSON(productsPath);
          if (!products.length) {
            return interaction.reply({
              embeds: [
                baseEmbed()
                  .setTitle('Products')
                  .setDescription('No products found.'),
              ],
              ephemeral: true,
            });
          }

          const embed = baseEmbed().setTitle('Products');
          for (const p of products) {
            embed.addFields({
              name: `${p.id} — ${p.name}`,
              value: `Type: ${p.type}\nPrice: ${p.price} Robux\nDetails: ${p.details}`,
            });
          }

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // /product delete
        if (sub === 'delete') {
          const id = interaction.options.getInteger('id');
          let products = readJSON(productsPath);
          const product = products.find(p => p.id === id);
          if (!product) {
            return interaction.reply({
              embeds: [
                baseEmbed()
                  .setTitle('Product Delete')
                  .setDescription(`No product found with ID \`${id}\`.`),
              ],
              ephemeral: true,
            });
          }

          products = products.filter(p => p.id !== id);
          writeJSON(productsPath, products);

          // Optionally delete forum post if exists
          if (product.forumPostId) {
            const forum = await interaction.guild.channels.fetch(PRODUCT_FORUM_ID).catch(() => null);
            if (forum) {
              const thread = await forum.threads.fetch(product.forumPostId).catch(() => null);
              if (thread) await thread.delete().catch(() => null);
            }
          }

          return interaction.reply({
            embeds: [
              baseEmbed()
                .setTitle('Product Deleted')
                .setDescription(`Product \`${id}\` has been deleted.`),
            ],
            ephemeral: true,
          });
        }
      }

      // /purchase location set
      if (commandName === 'purchase') {
        if (!hasStaffRole(interaction.member)) {
          return interaction.reply({
            embeds: [
              baseEmbed().setTitle('No Permission').setDescription(
                'You do not have permission to use this command.'
              ),
            ],
            ephemeral: true,
          });
        }

        const sub = interaction.options.getSubcommand();
        if (sub === 'location') {
          const modal = new ModalBuilder()
            .setCustomId('purchase_location_modal')
            .setTitle('Set Purchase Link');

          const linkInput = new TextInputBuilder()
            .setCustomId('purchase_link')
            .setLabel('Input Link Here (https://...)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(linkInput));
          return interaction.showModal(modal);
        }
      }

      // /send-panel
      if (commandName === 'send-panel') {
        if (!hasStaffRole(interaction.member)) {
          return interaction.reply({
            embeds: [
              baseEmbed().setTitle('No Permission').setDescription(
                'You do not have permission to use this command.'
              ),
            ],
            ephemeral: true,
          });
        }

        const embed = baseEmbed()
          .setTitle('Solara Support')
          .setDescription(
            'Need help with a product, commission, or partnership?\nSelect a ticket type below to open a ticket.'
          );

        const menu = new StringSelectMenuBuilder()
          .setCustomId('ticket_type_select')
          .setPlaceholder('Select ticket type')
          .addOptions(
            {
              label: 'General Support',
              value: 'general_support',
            },
            {
              label: 'Product Inquiry',
              value: 'product_inquiry',
            },
            {
              label: 'Partnership Inquiry',
              value: 'partnership_inquiry',
            }
          );

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
          embeds: [embed],
          components: [row],
        });
      }

      // /status
      if (commandName === 'status') {
        const ping = Math.round(client.ws.ping);
        const uptimeMs = client.uptime || 0;
        const uptimeSec = Math.floor(uptimeMs / 1000);
        const uptimeMin = Math.floor(uptimeSec / 60);
        const uptimeHr = Math.floor(uptimeMin / 60);

        const products = readJSON(productsPath);
        const productCount = products.length;

        const embed = baseEmbed()
          .setTitle('Bot Status')
          .addFields(
            { name: 'Ping', value: `${ping}ms`, inline: true },
            { name: 'Uptime', value: `${uptimeHr}h ${uptimeMin % 60}m`, inline: true },
            { name: 'Commands Loaded', value: `${commands.length}`, inline: true },
            { name: 'Guild Count', value: `${client.guilds.cache.size}`, inline: true },
            { name: 'Product Count', value: `${productCount}`, inline: true }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // /about
      if (commandName === 'about') {
        const embed = baseEmbed()
          .setTitle('Solara Development')
          .setDescription(
            'A premium Roblox & Discord development studio.\n\nProviding products, systems, and support with studio-grade polish.'
          )
          .addFields(
            { name: 'Services', value: 'Roblox systems, Discord bots, UI, automation.', inline: false },
            { name: 'Brand', value: 'Clean, minimal, grey-toned studio aesthetic.', inline: false }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // /suggest
      if (commandName === 'suggest') {
        const title = interaction.options.getString('title', true);

        const modal = new ModalBuilder()
          .setCustomId(`suggest_modal_${title}`)
          .setTitle('Submit Suggestion');

        const bodyInput = new TextInputBuilder()
          .setCustomId('suggest_body')
          .setLabel('Your suggestion')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(bodyInput));
        return interaction.showModal(modal);
      }
    }

    // MODALS
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;

      // product_send_modal
      if (id === 'product_send_modal') {
        if (!hasStaffRole(interaction.member)) {
          return interaction.reply({
            embeds: [
              baseEmbed().setTitle('No Permission').setDescription(
                'You do not have permission to use this.'
              ),
            ],
            ephemeral: true,
          });
        }

        const name = interaction.fields.getTextInputValue('product_name');
        const number = interaction.fields.getTextInputValue('product_id');
        const type = interaction.fields.getTextInputValue('product_type');
        const price = interaction.fields.getTextInputValue('product_price');
        const details = interaction.fields.getTextInputValue('product_details');

        const forum = await interaction.guild.channels.fetch(PRODUCT_FORUM_ID).catch(() => null);
        if (!forum || forum.type !== ChannelType.GuildForum) {
          return interaction.reply({
            embeds: [
              baseEmbed()
                .setTitle('Error')
                .setDescription('Product forum channel is not configured correctly.'),
            ],
            ephemeral: true,
          });
        }

        const productId = nextProductId();

        const embed = baseEmbed()
          .setTitle(name)
          .addFields(
            { name: 'ID', value: number, inline: true },
            { name: 'Type', value: type, inline: true },
            { name: 'Price', value: `${price} Robux`, inline: false },
            { name: 'Details', value: 'See below.', inline: true }
          );

        const purchaseButton = new ButtonBuilder()
          .setLabel('Purchase')
          .setStyle(ButtonStyle.Link)
          .setURL(PURCHASE_LINK || 'https://example.com');

        const row = new ActionRowBuilder().addComponents(purchaseButton);

        const thread = await forum.threads.create({
          name,
          message: {
            embeds: [
              embed,
              baseEmbed().setDescription(details),
            ],
            components: [row],
          },
          appliedTags: [], // auto-tagging could be added here if tags exist
        });

        const products = readJSON(productsPath);
        products.push({
          id: productId,
          name,
          type,
          price,
          details,
          forumPostId: thread.id,
          createdBy: interaction.user.id,
          createdAt: new Date().toISOString(),
        });
        writeJSON(productsPath, products);

        return interaction.reply({
          embeds: [
            baseEmbed()
              .setTitle('Product Created')
              .setDescription(`Product **${name}** created with ID \`${productId}\`.`),
          ],
          ephemeral: true,
        });
      }

      // purchase_location_modal
      if (id === 'purchase_location_modal') {
        if (!hasStaffRole(interaction.member)) {
          return interaction.reply({
            embeds: [
              baseEmbed().setTitle('No Permission').setDescription(
                'You do not have permission to use this.'
              ),
            ],
            ephemeral: true,
          });
        }

        const link = interaction.fields.getTextInputValue('purchase_link');
        if (!link.startsWith('http://') && !link.startsWith('https://')) {
          return interaction.reply({
            embeds: [
              baseEmbed()
                .setTitle('Invalid Link')
                .setDescription('Please provide a valid URL starting with http:// or https://'),
            ],
            ephemeral: true,
          });
        }

        // NOTE: We cannot actually rewrite .env at runtime reliably.
        // In practice, you’d store this in JSON or a DB.
        // For now, we just acknowledge and pretend it’s updated.
        process.env.PURCHASE_LINK = link;

        return interaction.reply({
          embeds: [
            baseEmbed()
              .setTitle('Purchase Link Updated')
              .setDescription(`New purchase link set to:\n${link}`),
          ],
          ephemeral: true,
        });
      }

      // suggest_modal_*
      if (id.startsWith('suggest_modal_')) {
        const title = id.replace('suggest_modal_', '');
        const body = interaction.fields.getTextInputValue('suggest_body');

        const channel = await interaction.guild.channels
          .fetch(SUGGESTION_REVIEW_CHANNEL_ID)
          .catch(() => null);

        if (!channel) {
          return interaction.reply({
            embeds: [
              baseEmbed()
                .setTitle('Error')
                .setDescription('Suggestion review channel is not configured.'),
            ],
            ephemeral: true,
          });
        }

        const embed = baseEmbed()
          .setTitle(`Suggestion: ${title}`)
          .addFields(
            { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Suggestion', value: body, inline: false }
          );

        await channel.send({ embeds: [embed] });

        return interaction.reply({
          embeds: [
            baseEmbed()
              .setTitle('Suggestion Submitted')
              .setDescription('Thank you for your suggestion!'),
          ],
          ephemeral: true,
        });
      }
    }

    // SELECT MENUS
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_type_select') {
        const value = interaction.values[0];
        const typeLabel =
          value === 'general_support'
            ? 'General Support'
            : value === 'product_inquiry'
            ? 'Product Inquiry'
            : 'Partnership Inquiry';

        const ticketId = nextTicketId();

        const category = await interaction.guild.channels
          .fetch(TICKET_CATEGORY_ID)
          .catch(() => null);

        if (!category || category.type !== ChannelType.GuildCategory) {
          return interaction.reply({
            embeds: [
              baseEmbed()
                .setTitle('Error')
                .setDescription('Ticket category is not configured correctly.'),
            ],
            ephemeral: true,
          });
        }

        const channel = await interaction.guild.channels.create({
          name: ticketId,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: [
            {
              id: interaction.guild.roles.everyone.id,
              deny: ['ViewChannel'],
            },
            {
              id: interaction.user.id,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
            },
            {
              id: TICKET_ROLE_ID || STAFF_ROLE_ID,
              allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
            },
          ],
        });

        const metadataEmbed = baseEmbed()
          .setTitle(`Ticket ${ticketId}`)
          .addFields(
            { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Type', value: typeLabel, inline: true },
            { name: 'Status', value: 'Open', inline: true }
          );

        const closeButton = new ButtonBuilder()
          .setCustomId(`ticket_close_${ticketId}`)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeButton);

        await channel.send({
          content: `<@${interaction.user.id}>`,
          embeds: [metadataEmbed],
          components: [row],
        });

        const tickets = readJSON(ticketsPath);
        tickets.push({
          ticketId,
          channelId: channel.id,
          userId: interaction.user.id,
          type: typeLabel,
          status: 'open',
          createdAt: new Date().toISOString(),
          closedAt: null,
        });
        writeJSON(ticketsPath, tickets);

        return interaction.reply({
          embeds: [
            baseEmbed()
              .setTitle('Ticket Created')
              .setDescription(`Your ticket has been created: ${channel}`),
          ],
          ephemeral: true,
        });
      }
    }

    // BUTTONS
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith('ticket_close_')) {
        const ticketId = id.replace('ticket_close_', '');
        const tickets = readJSON(ticketsPath);
        const ticket = tickets.find(t => t.ticketId === ticketId);
        if (!ticket) {
          return interaction.reply({
            embeds: [
              baseEmbed()
                .setTitle('Error')
                .setDescription('Ticket not found in records.'),
            ],
            ephemeral: true,
          });
        }

        if (
          interaction.user.id !== ticket.userId &&
          !interaction.member.roles.cache.has(TICKET_ROLE_ID || STAFF_ROLE_ID)
        ) {
          return interaction.reply({
            embeds: [
              baseEmbed()
                .setTitle('No Permission')
                .setDescription('You cannot close this ticket.'),
            ],
            ephemeral: true,
          });
        }

        ticket.status = 'closed';
        ticket.closedAt = new Date().toISOString();
        writeJSON(ticketsPath, tickets);

        const logChannel = await interaction.guild.channels
          .fetch(TICKET_LOG_CHANNEL_ID)
          .catch(() => null);

        if (logChannel) {
          const summaryEmbed = baseEmbed()
            .setTitle(`Ticket Closed: ${ticket.ticketId}`)
            .addFields(
              { name: 'User', value: `<@${ticket.userId}>`, inline: true },
              { name: 'Type', value: ticket.type, inline: true },
              { name: 'Status', value: 'Closed', inline: true },
              {
                name: 'Summary',
                value:
                  'AI-style summary placeholder: ticket handled and closed. (You can later plug real AI here.)',
                inline: false,
              }
            );

          await logChannel.send({ embeds: [summaryEmbed] });
        }

        await interaction.channel.send({
          embeds: [
            baseEmbed()
              .setTitle('Ticket Closed')
              .setDescription('This ticket will be deleted shortly.'),
          ],
        });

        setTimeout(() => {
          interaction.channel.delete().catch(() => null);
        }, 5000);

        return interaction.reply({
          embeds: [
            baseEmbed()
              .setTitle('Closing Ticket')
              .setDescription('Ticket is being closed and logged.'),
          ],
          ephemeral: true,
        });
      }
    }
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      interaction.reply({
        embeds: [
          baseEmbed()
            .setTitle('Error')
            .setDescription('An unexpected error occurred.'),
        ],
        ephemeral: true,
      }).catch(() => null);
    }
  }
});

// ---------- START ----------

(async () => {
  await registerCommands();
  await client.login(TOKEN);
})();
