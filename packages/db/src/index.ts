declare global {
  namespace PrismaJson {
    type BookVersion = { source: "openiti" | "turath"; value: string };

    type BookFlags = {
      aiSupported: boolean;
    };
  }
}

export type BookVersion = PrismaJson.BookVersion;
export type BookFlags = PrismaJson.BookFlags;

export * from "@prisma/client";
