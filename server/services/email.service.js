import nodemailer from "nodemailer";

export function createMailer() {
    const host = process.env.EMAIL_HOST;
    const port = Number(process.env.EMAIL_PORT || 465);
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
        throw new Error("Missing EMAIL_HOST / EMAIL_USER / EMAIL_PASS in .env");
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for 587
        auth: { user, pass },
    });
}

export async function sendLoginCodeEmail({ to, code }) {
    const transporter = createMailer();

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: "Your Sofkam Portal login code",
        html: `
      Hi,<br><br>
      Your login code is: <b style="font-size:18px">${code}</b><br><br>
      This code expires in <b>10 minutes</b>.<br><br>
      If you didn’t request this, ignore this email.
    `,
    });
}
