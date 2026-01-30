import { Groq } from 'groq-sdk';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PDFParse = require('pdf-parse');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        // Vercel serverless functions handle bodies differently. 
        // We ensure we are working with a Buffer.
        const dataBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);

        if (!dataBuffer || dataBuffer.length === 0) {
            return res.status(400).json({ error: "Empty PDF file received." });
        }

        const pdfData = await PDFParse(dataBuffer);
        const rawText = pdfData.text;

        const systemPrompt = `
        Extract data from this resume and return a JSON object. 
        Structure: { "name": "string", "email": "string", "bio": "tagline", "skills": [], "education": [], "experience": [], "achievements": [], "projects": [] }
        Return ONLY valid JSON.`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: rawText }
            ],
            model: "llama3-8b-8192",
            response_format: { type: "json_object" }
        });

        const data = JSON.parse(chatCompletion.choices[0].message.content);

        // Build the HTML (Ensure portfolio.css is linked correctly)
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <link rel="stylesheet" href="/portfolio.css">
            <title>\${data.name} | Portfolio</title>
        </head>
        <body>
            <header class="hero">
                <div class="container">
                    <h1>\${data.name}</h1>
                    <p class="tagline">\${data.bio}</p>
                </div>
            </header>
            <div class="container">
                <section><h2>Skills</h2><p>\${data.skills.join(', ')}</p></section>
                <section><h2>Experience</h2>\${data.experience.map(e => `<div><strong>\${e.role}</strong> - \${e.company}</div>`).join('')}</section>
                <section><h2>Projects</h2>\${data.projects.map(p => `<div><strong>\${p.title}</strong>: \${p.description}</div>`).join('')}</section>
            </div>
        </body>
        </html>`;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);

    } catch (error) {
        console.error("Conversion Error:", error);
        return res.status(500).json({ error: "Failed to process PDF", details: error.message });
    }
}
