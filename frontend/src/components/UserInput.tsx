"use client";

import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface PageProps {
    userInput: string;
    setUserInput: React.Dispatch<React.SetStateAction<string>>
    handleSubmit: (e: React.FormEvent) => void
}

export default function Component( {
userInput,
setUserInput,
handleSubmit
} : PageProps ) {
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <Input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} />
      </form>
    </div>
  );
}
