import React from 'react'

interface PageProps {
    output: string;
}

export default function Component({ output }: PageProps) {
  return (
    <div>{output}</div>
  );
}
