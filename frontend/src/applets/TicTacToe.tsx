"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Copy, Check, RefreshCw, Pipette, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

// Minimal types to keep TS happy without installing full @types for Pyodide
// (The CDN script exposes window.loadPyodide)
declare global {
  interface Window {
    loadPyodide?: (opts?: { indexURL?: string }) => Promise<any>;
    __pyodidePromise?: Promise<any> | null;
    __pyodideInstance?: any | null;
  }
}

type RunState = "idle" | "loading" | "ready" | "running" | "installing";

const PYODIDE_VERSION = "0.25.1"; // Adjust as needed
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;

async function ensurePyodide(): Promise<any> {
  if (window.__pyodideInstance) return window.__pyodideInstance;
  if (window.__pyodidePromise) return window.__pyodidePromise;

  window.__pyodidePromise = new Promise(async (resolve, reject) => {
    try {
      // Load script tag once
      if (!("loadPyodide" in window)) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = PYODIDE_URL;
          s.async = true;
          s.onload = () => res();
          s.onerror = () => rej(new Error("Failed to load Pyodide script"));
          document.head.appendChild(s);
        });
      }
      const pyodide = await window.loadPyodide?.({ indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/` });
      // Prime a couple of stdlib modules
      await pyodide.loadPackage(["micropip"]);
      window.__pyodideInstance = pyodide;
      resolve(pyodide);
    } catch (err) {
      window.__pyodidePromise = null;
      reject(err);
    }
  });

  return window.__pyodidePromise;
}

function classNames(...args: (string | false | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

const EXAMPLES: Record<string, string> = {
  "Hello": `print("Hello from Python! ")\nfor i in range(3):\n    print(f"Counting: {i}")`,
  "Fibonacci": `def fib(n):\n    a, b = 0, 1\n    out = []\n    while a < n:\n        out.append(a)\n        a, b = b, a+b\n    return out\n\nprint("Fibs < 100:", fib(100))`,
  "Stdlib HTTP": `import urllib.request, json\nresp = urllib.request.urlopen("https://httpbin.org/json").read().decode()\nobj = json.loads(resp)\nprint(obj["slideshow"]["title"])`,
  "Plot (matplotlib)": `# This will install matplotlib (large) then render to a PNG file inside the VM.\n# You can then ls() to see files and read it.\nimport micropip, sys\nprint("Installing matplotlib… (one-time)")\nawait micropip.install('matplotlib')\nimport matplotlib.pyplot as plt\nplt.plot([1,2,3,4],[10,7,12,5])\nplt.title('Pyodide Matplotlib Plot')\nplt.savefig('plot.png')\nprint('Saved plot.png')`,
};

export default function Component() {
  const [state, setState] = useState<RunState>("loading");
  const [code, setCode] = useState<string>(EXAMPLES["Hello"]);
  const [stdout, setStdout] = useState<string>("");
  const [stderr, setStderr] = useState<string>("");
  const [pkg, setPkg] = useState<string>("");
  const [copied, setCopied] = useState<"none" | "code" | "out">("none");
  const [themeMono, setThemeMono] = useState<boolean>(true);
  const [fsList, setFsList] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pyRef = useRef<any>(null);

  // Load Pyodide on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setState("loading");
        const py = await ensurePyodide();
        if (!mounted) return;
        pyRef.current = py;
        setState("ready");
        // Ensure we can list the FS
        refreshFs();
      } catch (err: any) {
        setState("idle");
        setStderr(String(err?.message || err));
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshFs = useCallback(() => {
    try {
      const py = pyRef.current;
      if (!py) return;
      const list = py.FS.readdir("/") as string[];
      setFsList(list.filter((n) => ![".", ".."].includes(n)));
    } catch {
      // ignore
    }
  }, []);

  const runCode = useCallback(async () => {
    const py = pyRef.current;
    if (!py) return;
    setState("running");
    setCopied("none");
    setStdout("");
    setStderr("");

    const wrapped = `\nimport sys, io, traceback\n_stdout, _stderr = sys.stdout, sys.stderr\nsys.stdout, sys.stderr = io.StringIO(), io.StringIO()\ntry:\n    # User code executes in global scope so variables persist across runs\n    exec(${JSON.stringify(code)}, globals(), globals())\nexcept Exception:\n    traceback.print_exc()\nout = sys.stdout.getvalue()\nerr = sys.stderr.getvalue()\nsys.stdout, sys.stderr = _stdout, _stderr\n(out, err)`;

    try {
      const result = await py.runPythonAsync(wrapped);
      // result may be a PyProxy tuple; convert safely
      // @ts-ignore
      const tuple = result?.toJs ? result.toJs() : result;
      const [out, err] = Array.isArray(tuple) ? tuple : [String(tuple), ""];
      // Clean up proxy to avoid leaks
      if (result && typeof result.destroy === "function") result.destroy();
      setStdout(String(out || ""));
      setStderr(String(err || ""));
    } catch (err: any) {
      setStderr(String(err?.message || err));
    } finally {
      setState("ready");
      refreshFs();
    }
  }, [code, refreshFs]);

  const installPkg = useCallback(async () => {
    const py = pyRef.current;
    if (!py || !pkg.trim()) return;
    setState("installing");
    setStdout("");
    setStderr("");
    try {
      // Use micropip to install a package (pure-Python wheels work best in Pyodide)
      await py.runPythonAsync(`import micropip\nprint('Installing ${pkg}…')\nawait micropip.install('${pkg}')\nprint('Done')`);
      setStdout((s) => s + `\nInstalled ${pkg}\n`);
      setPkg("");
    } catch (err: any) {
      setStderr(String(err?.message || err));
    } finally {
      setState("ready");
      refreshFs();
    }
  }, [pkg, refreshFs]);

  const resetRuntime = useCallback(async () => {
    // Drop instance and reload fresh
    pyRef.current = null;
    window.__pyodideInstance = null;
    window.__pyodidePromise = null;
    setStdout("");
    setStderr("");
    setState("loading");
    try {
      const py = await ensurePyodide();
      pyRef.current = py;
      setState("ready");
      refreshFs();
    } catch (err: any) {
      setState("idle");
      setStderr(String(err?.message || err));
    }
  }, [refreshFs]);

  const copyToClipboard = useCallback(async (text: string, which: "code" | "out") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied("none"), 1200);
    } catch {
      // ignore
    }
  }, []);

  const onUpload = useCallback(async (file: File) => {
    const py = pyRef.current;
    if (!py || !file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    try {
      py.FS.writeFile(file.name, buf);
      refreshFs();
      setStdout((s) => s + `Uploaded ${file.name} (${file.size} bytes)\n`);
    } catch (e: any) {
      setStderr(String(e?.message || e));
    }
  }, [refreshFs]);

  const statusBadge = useMemo(() => {
    const map: Record<RunState, { label: string; color: string }> = {
      idle: { label: "Idle", color: "bg-muted text-foreground" },
      loading: { label: "Loading Pyodide…", color: "bg-yellow-500 text-black" },
      ready: { label: "Ready", color: "bg-emerald-600 text-white" },
      running: { label: "Running…", color: "bg-blue-600 text-white" },
      installing: { label: "Installing…", color: "bg-purple-600 text-white" },
    };
    const s = map[state];
    return <Badge className={classNames("rounded-full", s.color)}>{s.label}</Badge>;
  }, [state]);

  const monoClass = themeMono ? "font-mono" : "";

  return (
    <div className="w-full mx-auto max-w-6xl p-4 md:p-6">
      <TooltipProvider delayDuration={200}>
        <Card className="shadow-xl border-border/60">
          <CardHeader className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Python Interpreter (Pyodide)</h1>
              <div className="flex items-center gap-2">
                {statusBadge}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={resetRuntime} disabled={state === "loading" || state === "installing"}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset runtime</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant={themeMono ? "default" : "outline"} size="icon" onClick={() => setThemeMono((v) => !v)}>
                      <Palette className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle monospace editor</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Run real Python in your browser via WebAssembly. Install pure-Python packages with <span className="font-mono">micropip</span>, inspect the virtual filesystem, and persist variables between runs.</p>
          </CardHeader>

          <Separator />

          <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Left: Editor & actions */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="examples" className="text-sm">Examples</Label>
                  <select
                    id="examples"
                    className="px-2 py-1 border rounded-md bg-background text-sm"
                    onChange={(e) => setCode(EXAMPLES[e.target.value])}
                  >
                    {Object.keys(EXAMPLES).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copyToClipboard(code, "code")}
                        disabled={!code}
                        className="gap-2"
                      >
                        {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy code</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={runCode}
                        disabled={state !== "ready"}
                        className="gap-2"
                      >
                        ▶ Run
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Execute in the Pyodide VM</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={classNames("min-h-[280px] md:min-h-[360px] resize-y rounded-xl p-3 shadow-sm", monoClass)}
                spellCheck={false}
                placeholder="# Write Python here…"
              />

              <Tabs defaultValue="pip" className="w-full">
                <TabsList>
                  <TabsTrigger value="pip">Packages</TabsTrigger>
                  <TabsTrigger value="fs">Files</TabsTrigger>
                </TabsList>
                <TabsContent value="pip" className="mt-3">
                  <div className="flex flex-col md:flex-row items-stretch md:items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor="pkg">Install package (micropip)</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="pkg"
                          value={pkg}
                          onChange={(e) => setPkg(e.target.value)}
                          placeholder="e.g. numpy (limited), requests (use httpx)"
                          className="font-mono"
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button onClick={installPkg} disabled={state !== "ready" || !pkg.trim()} className="gap-2">
                              <Pipette className="h-4 w-4" /> Install
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Install pure-Python wheels when possible</TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Note: Many scientific packages work, but native-extension wheels may not. Prefer pure-Python packages.</p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="fs" className="mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label className="text-sm">Virtual filesystem (/) </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input ref={fileInputRef} type="file" onChange={(e) => e.currentTarget.files && onUpload(e.currentTarget.files[0])} />
                      <Button variant="outline" size="sm" onClick={refreshFs}>Refresh</Button>
                    </div>
                  </div>
                  <ScrollArea className="h-36 mt-2 rounded-md border p-2">
                    {fsList.length === 0 ? (
                      <p className="text-sm text-muted-foreground">(empty)</p>
                    ) : (
                      <ul className="text-sm grid grid-cols-2 md:grid-cols-3 gap-2">
                        {fsList.map((n) => (
                          <li key={n} className="font-mono truncate">{n}</li>
                        ))}
                      </ul>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>

            {/* Right: Output */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Console output</h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="secondary" size="sm" onClick={() => copyToClipboard([stdout, stderr].filter(Boolean).join("\n"), "out")} className="gap-2">
                      {copied === "out" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy stdout + stderr</TooltipContent>
                </Tooltip>
              </div>
              <div className="rounded-xl border p-3 bg-muted/30">
                <Label className="text-xs text-muted-foreground">stdout</Label>
                <pre className={classNames("mt-1 whitespace-pre-wrap break-words min-h-[120px] text-sm", monoClass)}>{stdout || ""}</pre>
              </div>
              <div className="rounded-xl border p-3 bg-muted/30">
                <Label className="text-xs text-muted-foreground">stderr</Label>
                <pre className={classNames("mt-1 whitespace-pre-wrap break-words min-h-[80px] text-sm text-red-600", monoClass)}>{stderr || ""}</pre>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Pyodide</span>
              <span className="font-mono">v{PYODIDE_VERSION}</span>
            </div>
            <div>
              Variables persist between runs (executed in global scope). Use <span className="font-mono">reset</span> to start fresh.
            </div>
          </CardFooter>
        </Card>
      </TooltipProvider>
    </div>
  );
}
