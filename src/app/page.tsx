import ChatUI from "@/components/ChatUI";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-zinc-100 dark:bg-black">
      <div className="w-full max-w-4xl h-[80vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-6 text-zinc-800 dark:text-zinc-200">
          Nuigurumi Agent
        </h1>
        <ChatUI />
      </div>
    </main>
  );
}
