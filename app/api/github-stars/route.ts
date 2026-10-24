import { NextResponse } from "next/server";

const REPOSITORY = "Nitinref/seezer.ai";

export async function GET() {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPOSITORY}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "sizzer.ai",
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const repository = (await response.json()) as { stargazers_count: number };
    return NextResponse.json(
      { stars: repository.stargazers_count },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ stars: null }, { status: 200 });
  }
}
