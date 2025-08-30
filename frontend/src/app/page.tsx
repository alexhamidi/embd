"use client";

import TicTacToe from "@/applets/TicTacToe";
import Component from "@/applets/Base";
import Interpreter from "@/applets/Interpreter";
import UserInput from "@/components/UserInput"
import { useState } from 'react'

export default function Home() {
  const [userInput, setUserInput] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(userInput);
    
    const {js, html} = `API call to backend with userInput`;

    eval(js);
    setOutput(html);
  }

  return (<>
      <UserInput userInput={userInput} setUserInput={setUserInput} handleSubmit={handleSubmit}/>
      <div dangerouslySetInnerHTML={{ __html: output }} />
      <Interpreter />
    </>);
}
