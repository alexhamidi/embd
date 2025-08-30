"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";

// Simple, minimal todo list with local persistence

type Todo = {
  id: string;
  text: string;
  done: boolean;
};

type Filter = "all" | "active" | "done";

function uuid() {
  try {
    // @ts-ignore - guard for older runtimes
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2, 10);
}

export default function Component() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Load / Save
  useEffect(() => {
    const raw = localStorage.getItem("todos:v1");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Todo[];
        setTodos(Array.isArray(parsed) ? parsed : []);
      } catch {
        setTodos([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("todos:v1", JSON.stringify(todos));
  }, [todos]);

  const leftCount = useMemo(() => todos.filter(t => !t.done).length, [todos]);

  const filtered = useMemo(() => {
    if (filter === "active") return todos.filter(t => !t.done);
    if (filter === "done") return todos.filter(t => t.done);
    return todos;
  }, [todos, filter]);

  function addTodo(text?: string) {
    const value = (text ?? draft).trim();
    if (!value) return;
    setTodos(prev => [{ id: uuid(), text: value, done: false }, ...prev]);
    setDraft("");
    inputRef.current?.focus();
  }

  function toggle(id: string, next: boolean) {
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, done: next } : t)));
  }

  function remove(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  function clearCompleted() {
    setTodos(prev => prev.filter(t => !t.done));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    addTodo();
  }

  return (
    <div className="min-h-[60vh] w-full grid place-items-center p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Todo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a task..."
              aria-label="Add a task"
            />
            <Button type="submit" aria-label="Add">
              <Plus className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{leftCount} left</div>
            <div className="flex gap-1">
              {(["all", "active", "done"] as Filter[]).map((f) => (
                <Button
                  key={f}
                  type="button"
                  variant={filter === f ? "default" : "secondary"}
                  className="h-8 px-3"
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>

          <ul className="mt-3 divide-y rounded-lg border">
            {filtered.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">Nothing here.</li>
            )}
            {filtered.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-3">
                <Checkbox
                  checked={t.done}
                  onCheckedChange={(v) => toggle(t.id, Boolean(v))}
                  aria-label={t.done ? "Mark as not done" : "Mark as done"}
                />
                <span className={"flex-1 text-sm " + (t.done ? "line-through text-muted-foreground" : "")}>{t.text}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(t.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-end">
            <Button variant="ghost" className="h-8" onClick={clearCompleted}>
              Clear done
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
