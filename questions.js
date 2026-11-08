// Radar axes (order = order on the chart)
const AXES = [
  { id: "backend",    label: "Backend & data engineering", short: "Backend",      color: "#54A0FF" },
  { id: "frontend",   label: "Frontend & web dev",          short: "Frontend",     color: "#48DBFB" },
  { id: "data",       label: "Data analysis & statistics",  short: "Data & Stats", color: "#1DD1A1" },
  { id: "earth",      label: "Earth science & remote sensing", short: "Earth Sci", color: "#7BED9F" },
  { id: "ai",         label: "AI / ML",                     short: "AI / ML",      color: "#A29BFE" },
  { id: "proto",      label: "Rapid prototyping",           short: "Prototyping",  color: "#FF8787" },
  { id: "design",     label: "UI/UX & visual design",       short: "Design",       color: "#FD79A8" },
  { id: "story",      label: "Storytelling, pitch & docs",  short: "Story & Docs", color: "#FECA57" },
  { id: "leadership", label: "Leadership & teamwork",       short: "Leadership",   color: "#FF9F43" }
];

const QUESTIONS = [
  // Backend & data engineering
  { axis: "backend", text: "Processing data with Python (pandas, NumPy)", options: [
    { label: "I use it daily and handle large datasets", pts: 4 },
    { label: "I've done a few projects with it", pts: 3 },
    { label: "I know basic Python, I'd pick it up fast", pts: 2 },
    { label: "Never used it", pts: 1 },
    { label: "I'd rather not", pts: 0 } ] },
  { axis: "backend", text: "Building APIs, backends or deploying apps", options: [
    { label: "I've built and deployed APIs myself", pts: 4 },
    { label: "I've worked on a backend in a project", pts: 3 },
    { label: "I understand the concepts", pts: 2 },
    { label: "Never done it", pts: 1 },
    { label: "Not for me", pts: 0 } ] },

  // Frontend & web dev
  { axis: "frontend", text: "Building web frontends (HTML/CSS/JS, React)", options: [
    { label: "I've shipped full web apps", pts: 4 },
    { label: "I've built a few pages or components", pts: 3 },
    { label: "I can tweak existing code", pts: 2 },
    { label: "Never built one", pts: 1 },
    { label: "Not for me", pts: 0 } ] },
  { axis: "frontend", text: "Interactive maps (Leaflet, Mapbox)", options: [
    { label: "I've built map-based apps", pts: 4 },
    { label: "I've played with a map library", pts: 3 },
    { label: "I've used them but never coded one", pts: 2 },
    { label: "No experience", pts: 1 },
    { label: "Not for me", pts: 0 } ] },

  // Data analysis & statistics
  { axis: "data", text: "Statistics and time series analysis", options: [
    { label: "Strong background, I do it in my studies or work", pts: 4 },
    { label: "I've done some analysis projects", pts: 3 },
    { label: "I know the basics", pts: 2 },
    { label: "Very little", pts: 1 },
    { label: "I'd rather not", pts: 0 } ] },
  { axis: "data", text: "Charts and data visualization", options: [
    { label: "I build clear, polished charts regularly", pts: 4 },
    { label: "I've made charts for projects", pts: 3 },
    { label: "Only basic Excel-style charts", pts: 2 },
    { label: "Never", pts: 1 },
    { label: "Not for me", pts: 0 } ] },

  // Earth science & remote sensing
  { axis: "earth", text: "Satellite data (FIRMS, MODIS, VIIRS, GIS formats)", options: [
    { label: "I've worked with satellite data directly", pts: 4 },
    { label: "I've used geospatial data before", pts: 3 },
    { label: "I've read about it", pts: 2 },
    { label: "New to me", pts: 1 },
    { label: "Not interested", pts: 0 } ] },
  { axis: "earth", text: "Fire, climate or environmental topics", options: [
    { label: "I know the science well", pts: 4 },
    { label: "I've studied or followed it closely", pts: 3 },
    { label: "General interest", pts: 2 },
    { label: "Not much", pts: 1 },
    { label: "Not interested", pts: 0 } ] },

  // AI / ML
  { axis: "ai", text: "Training ML models", options: [
    { label: "I've trained and evaluated models in real projects", pts: 4 },
    { label: "I've done ML coursework or small projects", pts: 3 },
    { label: "I understand the basics", pts: 2 },
    { label: "Never", pts: 1 },
    { label: "Not for me", pts: 0 } ] },
  { axis: "ai", text: "Integrating AI into apps (LLM APIs, RAG, prompting)", options: [
    { label: "I've built AI features into real apps", pts: 4 },
    { label: "I've integrated an LLM API in a project", pts: 3 },
    { label: "I've experimented with it", pts: 2 },
    { label: "Never", pts: 1 },
    { label: "Not for me", pts: 0 } ] },

  // Rapid prototyping
  { axis: "proto", text: "Coding fast with AI tools (Copilot, Cursor, coding agents)", options: [
    { label: "I use them daily to ship code", pts: 4 },
    { label: "I use them often", pts: 3 },
    { label: "Occasionally", pts: 2 },
    { label: "Rarely or never", pts: 1 },
    { label: "I prefer not to", pts: 0 } ] },
  { axis: "proto", text: "Shipping a working demo under time pressure", options: [
    { label: "I do it regularly (hackathons, side projects)", pts: 4 },
    { label: "I've done it a few times", pts: 3 },
    { label: "Once or twice", pts: 2 },
    { label: "Never", pts: 1 },
    { label: "I'd rather not", pts: 0 } ] },

  // UI/UX & visual design
  { axis: "design", text: "Designing interfaces (Figma, layouts)", options: [
    { label: "I design UIs regularly", pts: 4 },
    { label: "I've designed a few", pts: 3 },
    { label: "I have a good eye but little practice", pts: 2 },
    { label: "No experience", pts: 1 },
    { label: "Not for me", pts: 0 } ] },
  { axis: "design", text: "Visual assets (logos, slides, graphics)", options: [
    { label: "I create polished visuals often", pts: 4 },
    { label: "I've made some", pts: 3 },
    { label: "Basic Canva level", pts: 2 },
    { label: "Never", pts: 1 },
    { label: "Not for me", pts: 0 } ] },

  // Storytelling, pitch & docs
  { axis: "story", text: "Making a demo video (recording, editing)", options: [
    { label: "I edit videos confidently", pts: 4 },
    { label: "I've made a few", pts: 3 },
    { label: "I could figure it out", pts: 2 },
    { label: "Never", pts: 1 },
    { label: "I'd rather not", pts: 0 } ] },
  { axis: "story", text: "Pitching and presenting a project", options: [
    { label: "I enjoy it and have done it often", pts: 4 },
    { label: "I've presented a few times", pts: 3 },
    { label: "I can do it if needed", pts: 2 },
    { label: "I avoid it", pts: 1 },
    { label: "Please no", pts: 0 } ] },
  { axis: "story", text: "Technical writing (README, project description)", options: [
    { label: "I write clear docs often", pts: 4 },
    { label: "I've written some", pts: 3 },
    { label: "I can write decently", pts: 2 },
    { label: "Not my strength", pts: 1 },
    { label: "I'd rather not", pts: 0 } ] },

  // Leadership & teamwork
  { axis: "leadership", text: "Coordinating a team (splitting tasks, tracking deadlines)", options: [
    { label: "I've led teams before", pts: 4 },
    { label: "I've coordinated small groups", pts: 3 },
    { label: "I can help organize", pts: 2 },
    { label: "I prefer to follow", pts: 1 },
    { label: "Not for me", pts: 0 } ] },
  { axis: "leadership", text: "Building a project from scratch with a team", options: [
    { label: "Many times", pts: 4 },
    { label: "A few times", pts: 3 },
    { label: "Once", pts: 2 },
    { label: "Never", pts: 0 } ] },
  { axis: "leadership", text: "How many hackathons have you done?", options: [
    { label: "4 or more", pts: 4 },
    { label: "2 to 3", pts: 3 },
    { label: "1", pts: 2 },
    { label: "None, this is my first", pts: 0 } ] }
];

// Tasks for the ranked preference step (up to 4, plus "Other")
const TASKS = [
  "Frontend & web app",
  "Interactive fire map",
  "FIRMS data pipeline",
  "MODIS/VIIRS harmonization",
  "Statistics & anomaly detection",
  "ML / forecasting model",
  "Fire calendar & charts",
  "UI/UX design",
  "Demo video",
  "Pitch & presentation",
  "README & project docs",
  "Team coordination"
];

// Logistics (not scored, not shown on the card)
const LOGISTICS = [
  { id: "meetings", label: "Meetings", text: "Can you join team meetings before the hackathon (9 to 13 Nov)?",
    options: ["Yes, most days", "Some days", "Probably not"] },
  { id: "briefing", label: "Briefing 13 Nov", text: "Will you attend the in-person briefing in Singapore on Friday 13 Nov?",
    options: ["Yes", "Probably", "Not sure", "No"] }
];
