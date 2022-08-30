#!/usr/bin/env node

const fs = require("fs");

function htescape(s) { return s.replace(/[&<>]/g, $0 => { return {"&": "&amp;", "<": "&lt;", ">": "&gt;"}[$0]; }).replace(/\n/g, '<br />'); }
function atescape(s) { return s.replace(/[&<>"]/g, $0 => { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;"}[$0]; }); }
function format_date(date) { return `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日(${'日月日水木金土'.charAt(date.getDay())}) ${date.toTimeString()}`; }

const workspaceUsers = {};

function message_get_user(message) {
  if (message.user_profile && message.user_profile.name)
    return message.user_profile.name;

  if (!message.user) return "<Unknown User>";

  const profile = workspaceUsers[message.user];
  if (profile && profile.name) return profile.name;

  return "<" + message.user + ">";
}
function message_get_username(message) {
  if (message.user_profile) {
    const name = message.user_profile.display_name || message.user_profile.real_name;
    if (name) return name;
  }

  if (!message.user) return "<Unknown User>";

  const profile = workspaceUsers[message.user];
  if (profile && profile.profile) {
    const name = profile.profile.display_name || profile.profile.real_name;
    if (name) return name;
  }
  if (profile && profile.real_name)
    return profile.real_name;

  return message.user;
}
function message_get_user_icon(msg) {
  if (msg.user_profile && msg.user_profile.image_72)
    return msg.user_profile.image_72;

  const profile = workspaceUsers[msg.user];
  if (profile && profile.profile && profile.profile.image_72)
    return profile.profile.image_72;

  return null;
}

function convert_elements(elements, buff) {
  elements.forEach(element => {

    switch (element.type) {
    case 'rich_text':
      if (!element.elements) {
        console.error(`{type=${element.type}} does not have the member "elements"`);
        process.exit(1);
      }
      buff.push('<div>');
      convert_elements(element.elements, buff);
      buff.push('</div>\n');
      return;
    case 'rich_text_section':
      if (!element.elements) {
        console.error(`{type=${element.type}} does not have the member "elements"`);
        process.exit(1);
      }
      buff.push('<div class="slack-element-section">');
      convert_elements(element.elements, buff);
      buff.push('</div>\n');
      return;
    case 'rich_text_quote':
      if (!element.elements) {
        console.error(`{type=${element.type}} does not have the member "elements"`);
        process.exit(1);
      }
      buff.push('<blockquote class="slack-element-quote">');
      convert_elements(element.elements, buff);
      buff.push('</blockquote>\n');
      return;
    case 'rich_text_list':
      if (!element.elements) {
        console.error(`{type=${element.type}} does not have the member "elements"`);
        process.exit(1);
      }
      buff.push('<ul class="slack-element-list"><li>');
      convert_elements(element.elements, buff);
      buff.push('</li></ul>\n');
      return;
    case 'rich_text_preformatted':
      if (!element.elements) {
        console.error(`{type=${element.type}} does not have the member "elements"`);
        process.exit(1);
      }
      buff.push('<pre class="slack-element-pre">');
      convert_elements(element.elements, buff);
      buff.push('</pre>\n');
      return;
    case 'link':
      let attrs = '';
      if (element.style && element.style.code)
        attrs += ' class="slack-element-code"';
      buff.push(`<a href="${atescape(element.url)}"${attrs}>${htescape(element.text || element.url)}</a>`);
      return;
    case 'text':
      buff.push(htescape(element.text));
      return;
    }

    if (element.elements) {
      console.error(`warning: Unsupported RichTextElement: type=${element.type}`);
      convert_elements(element.elements, buff);
    } else if (element.text) {
      console.error(`warning: Unsupported RichTextElement: type=${element.type}`);
      buff.push(htescape(element.text));
    } else {
      console.error(`Unsupported strcuture of RichTextElement: type=${element.type}`);
      process.exit();
    }
  });
}
function convert_blocks(blocks) {
  const buff = [];
  convert_elements(blocks, buff);
  return buff.join('');
}
function message_to_html(msg) {
  const buff = [];
  // if (msg.type == "message") {}

  const styles = [];
  const icon = message_get_user_icon(msg);
  if (icon) styles.push(`background-image: url(${atescape(icon)});`);

  let attrs = '';
  if (styles.length)
    attrs += ` style="${styles.join("")}"`;

  buff.push(`<div class="slack-message"${attrs}>\n`);
  buff.push('<div>');
  buff.push('<b>' + atescape(message_get_username(msg)) + '</b> <code>@' + htescape(message_get_user(msg)) + '</code>');
  if (msg.ts)
    buff.push(` <span class="slack-timestamp">${format_date(new Date(parseFloat(msg.ts) * 1000))}</span>`);
  buff.push('</div>\n');

  if (msg.blocks) {
    buff.push(convert_blocks(msg.blocks));
  } else {
    buff.push('<div>');
    buff.push(htescape(msg.text));
    buff.push('</div>\n');
  }

  if (msg.reply_msgs) {
    buff.push('<div class="slack-replies">\n');
    msg.reply_msgs.forEach(msg => {
      buff.push(message_to_html(msg));
    });
    buff.push('</div>\n');
  }

  buff.push('</div>\n');
  return buff.join('');
}

const workspaceDirectory = process.argv[2];

JSON.parse(fs.readFileSync(workspaceDirectory + '/users.json', "utf8")).forEach(user => { workspaceUsers[user.id] = user; });

JSON.parse(fs.readFileSync(workspaceDirectory + '/channels.json', "utf8")).forEach(channel => {
  const channelDirectory = `${workspaceDirectory}/${channel.name}`;
  const ostr = fs.createWriteStream(channel.name + '.html');
  ostr.write('<!DOTYPE html>\n');
  ostr.write('<html>\n');
  ostr.write('<head>\n');
  ostr.write('<link rel="stylesheet" charset="utf-8" href="slack-export2html.css" />\n');
  ostr.write('</head>\n');
  ostr.write('<body>\n');
  ostr.write(`<h1>Channnel: ${channel.name}</h1>\n`);
  if (channel.purpose && channel.purpose.value)
    ostr.write(`<p>${htescape(channel.purpose.value)}</p>`);

  fs.readdir(channelDirectory, (err, files) => {
    if (err) {
      console.error(`failed to open the channel directory "${channelDirectory}".`);
      process.exit(1);
    }

    const messages = [];
    const message_dict = {};

    let msgCount = 0;
    files.forEach(inputFile => {
      if (!/\.json$/.test(inputFile)) return;
      inputFile = channelDirectory + '/' + inputFile;

      if (msgCount) {
        messages.push('<hr />');
        msgCount = 0;
      }

      JSON.parse(fs.readFileSync(inputFile, "utf8")).forEach(message => {
        let target_msgs = messages;
        if (message.thread_ts && message.thread_ts != message.ts) {
          let parent = null;
          if (message.parent_user_id) {
            parent = message_dict[`${message.thread_ts} ${message.parent_user_id}`];
          } else {
            // 何故か parent_user_id が存在しない場合がある。
            parent = message_dict[message.thread_ts];
          }
          if (parent) {
            if (!parent.reply_msgs) parent.reply_msgs = [];
            target_msgs = parent.reply_msgs;
          }
        }
        target_msgs.push(message);

        if (target_msgs === messages) msgCount++;

        if (message.ts) {
          if (message.user)
            message_dict[`${message.ts} ${message.user}`] = message;
          message_dict[message.ts] = message;
        }
      });
    });

    messages.forEach(msg => {
      if (typeof msg === 'string') {
        ostr.write(msg);
      } else {
        ostr.write(message_to_html(msg));
      }
      ostr.write('\n');
    });
  });

  ostr.write('</body>\n');
  ostr.write('</html>\n');
  //ostr.end();
});
