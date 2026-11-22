import { createServer, type Server, type Socket } from "node:net";
import type { AddressInfo } from "node:net";

/**
 * A tiny SMTP server for tests: accepts any login, keeps every message in memory, sends nothing anywhere.
 * Just enough of the protocol for nodemailer (EHLO, AUTH PLAIN/LOGIN, MAIL, RCPT, DATA, QUIT).
 */
export interface CapturedMail {
  from: string;
  to: string[];
  data: string;
}

export interface SmtpSink {
  port: number;
  mails: CapturedMail[];
  close: () => Promise<void>;
}

export async function startSmtpSink(): Promise<SmtpSink> {
  const mails: CapturedMail[] = [];
  const server: Server = createServer((socket: Socket) => {
    let from = "";
    let to: string[] = [];
    let inData = false;
    let data = "";
    let authStep: "none" | "user" | "pass" = "none";
    let buffer = "";
    const reply = (line: string) => socket.write(line + "\r\n");
    reply("220 sink ESMTP");

    const handleLine = (line: string) => {
      if (inData) {
        if (line === ".") {
          inData = false;
          mails.push({ from, to, data });
          data = "";
          to = [];
          reply("250 queued");
        } else {
          data += (line.startsWith("..") ? line.slice(1) : line) + "\n";
        }
        return;
      }
      if (authStep === "user") {
        authStep = "pass";
        return reply("334 UGFzc3dvcmQ6");
      }
      if (authStep === "pass") {
        authStep = "none";
        return reply("235 ok");
      }
      const cmd = line.toUpperCase();
      if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) {
        socket.write("250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
      } else if (cmd.startsWith("AUTH PLAIN")) reply("235 ok");
      else if (cmd.startsWith("AUTH LOGIN")) {
        authStep = "user";
        reply("334 VXNlcm5hbWU6");
      } else if (cmd.startsWith("MAIL FROM")) {
        from = /<([^>]*)>/.exec(line)?.[1] ?? "";
        reply("250 ok");
      } else if (cmd.startsWith("RCPT TO")) {
        to.push(/<([^>]*)>/.exec(line)?.[1] ?? "");
        reply("250 ok");
      } else if (cmd.startsWith("DATA")) {
        inData = true;
        reply("354 go");
      } else if (cmd.startsWith("QUIT")) {
        reply("221 bye");
        socket.end();
      } else reply("250 ok");
    };

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let i: number;
      while ((i = buffer.indexOf("\r\n")) >= 0) {
        handleLine(buffer.slice(0, i));
        buffer = buffer.slice(i + 2);
      }
    });
    socket.on("error", () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    mails,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Decodes quoted-printable text (nodemailer uses it for non-ASCII), so tests can search the body. */
export function decodeQuotedPrintable(s: string): string {
  const joined = s.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === "=" && /^[0-9A-F]{2}$/i.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...Buffer.from(joined[i], "utf8"));
  }
  return Buffer.from(bytes).toString("utf8");
}
