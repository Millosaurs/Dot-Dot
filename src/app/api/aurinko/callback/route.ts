// /api/aurinko/callback

import { waitUntil } from "@vercel/functions";
import { exchangeCodeForToken, getAccDetails } from "@/lib/aurinko";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export const GET = async (req: NextRequest) => {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const status = params.get("status");
  if (status !== "success")
    return NextResponse.json(
      { message: "Failed to link acc" },
      { status: 400 },
    );
  const code = params.get("code");
  if (!code)
    return NextResponse.json(
      { message: "Missing code from aurinko" },
      { status: 400 },
    );
  const token = await exchangeCodeForToken(code);
  if (!token)
    return NextResponse.json(
      { message: "Failed to exchange token" },
      { status: 400 },
    );
  const accDetails = await getAccDetails(token.accessToken);

  await db.account.upsert({
    where: {
      id: token.accountId.toString(),
    },
    update: {
      accessToken: token.accessToken,
    },
    create: {
      id: token.accountId.toString(),
      userId,
      emailAddress: accDetails.email,
      name: accDetails.name,
      accessToken: token.accessToken,
    },
  });

  //trigger initial sync endpoint (api)
  waitUntil(
    axios
      .post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/initial-sync`, {
        accountId: token.accountId.toString(),
        userId,
      })
      .then((responce) => {
        console.log("Initial sync triggered", responce.data);
      })
      .catch((error) => {
        console.log("Initial sync failed", error);
      }),
  );

  return NextResponse.redirect(new URL("/mail", req.url));
};
