import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildPrompt } from "@breason/prompts";
import { MarketKey, PromptKey } from "@breason/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { action, market, text } = await req.json();
    
    if (!market) return NextResponse.json({ error: "Market is required" }, { status: 400 });

    const prompt = buildPrompt(action as PromptKey, market as MarketKey, text);
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);
    
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
