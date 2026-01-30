import PDFParse from 'pdf-parse';
import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const dataBuffer = Buffer.from(req.body, 'binary');
        const pdfData = await PDFParse(dataBuffer);
        const rawText = pdfData.text;

        const systemPrompt = `
        Extract data from this resume and return a JSON object. 
        Structure:
        {
          "name": "string",
          "email": "string",
          "bio": "one sentence professional tagline",
          "skills": ["string"],
          "education": [{"school": "string", "degree": "string", "year": "string"}],
          "experience": [{"role": "string", "company": "string", "duration": "string", "desc": "string"}],
          "achievements": ["string"],
          "projects": [{"title": "string", "techStack": "string", "description": "string"}]
        }
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

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="/portfolio.css">
            <title>\${data.name} | Portfolio</title>
        </head>
        <body>
            <header class="hero">
                <div class="container">
                    <h1>\${data.name}</h1>
                    <p class="tagline">\${data.bio}</p>
                    <a href="mailto:\${data.email}" class="btn-primary">Get In Touch</a>
                </div>
            </header>

            <div class="container">
                <section>
                    <h2>Technical Skills</h2>
                    <div class="skills-grid">
                        \${data.skills.map(s => `<span class="tag">\${s}</span>`).join('')}
                    </div>
                </section>

                <section>
                    <h2>Experience</h2>
                    \${data.experience.map(e => `
                        <div class="card">
                            <div class="card-header">
                                <strong>\${e.role}</strong>
                                <span>\${e.duration}</span>
                            </div>
                            <div class="company">\${e.company}</div>
                            <p>\${e.desc}</p>
                        </div>
                    `).join('')}
                </section>

                <section>
                    <h2>Featured Projects</h2>
                    <div class="project-grid">
                        \${data.projects.map(p => `
                            <div class="card project-card">
                                <h3>\${p.title}</h3>
                                <p>\${p.description}</p>
                                <div class="tech-stack">\${p.techStack}</div>
                            </div>
                        `).join('')}
                    </div>
                </section>

                <section>
                    <h2>Education</h2>
                    \${data.education.map(ed => `
                        <div class="edu-item">
                            <strong>\${ed.degree}</strong> - \${ed.school} (\${ed.year})
                        </div>
                    `).join('')}
                </section>

                <section>
                    <h2>Achievements</h2>
                    <ul class="achievements-list">
                        \${data.achievements.map(a => `<li>\${a}</li>`).join('')}
                    </ul>
                </section>
            </div>
            <footer>
                <p>&copy; 2026 \${data.name} | Built with Resume-to-SaaS</p>
            </footer>
        </body>
        </html>`;

        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);

    } catch (error) {
        res.status(500).json({ error: "Parsing failed", details: error.message });
    }
}
