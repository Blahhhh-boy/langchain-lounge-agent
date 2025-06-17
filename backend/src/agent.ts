import {config} from "dotenv";
config();
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

async function setupAgent() {
  try {
    // Wait a bit to ensure the MCP server is ready
    console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY! ? 'Found' : 'Not found');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Define the tools for the agent to use
    const mcpClient = new MultiServerMCPClient({
      throwOnLoadError: true,
      prefixToolNameWithServerName: false,
      mcpServers: {
        loungeServer: {
          url: "http://localhost:3000",
          automaticSSEFallback: false
        }
      },
    });
    
    console.log("Connecting to MCP server...");
    const tools = await mcpClient.getTools();
    console.log("Available tools:", tools.map(t => t.name));
    
    const toolNode = new ToolNode(tools);

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      apiKey: process.env.GOOGLE_API_KEY
    }).bindTools(tools);

    function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
      const lastMessage = messages[messages.length - 1] as AIMessage;

      if (lastMessage.tool_calls?.length) {
        return "tools";
      }
      return "__end__";
    }

    // Define the function that calls the model
    async function callModel(state: typeof MessagesAnnotation.State) {
      const response = await model.invoke(state.messages);
      // We return a list, because this will get added to the existing list
      return { messages: [response] };
    }

    const workflow = new StateGraph(MessagesAnnotation)
      .addNode("agent", callModel)
      .addEdge("__start__", "agent") // __start__ is a special name for the entrypoint
      .addNode("tools", toolNode)
      .addEdge("tools", "agent")
      .addConditionalEdges("agent", shouldContinue);

    const app = workflow.compile();

    // Use the agent with actual flight/lounge queries
    console.log("Getting available lounges...");
    const loungeState = await app.invoke({
      messages: [new HumanMessage("Get me the available lounges for session 00009223581026309436128527")],
    });
    
    console.log("Lounge Response:", loungeState.messages[loungeState.messages.length - 1].content);

    console.log("\nGetting flight information...");
    const flightState = await app.invoke({
      messages: [
        ...loungeState.messages, 
        new HumanMessage("Get flight data for session 00009223581026309436128527, departure from NMIA on 20241225 for flight AC920")
      ],
    });
    
    console.log("Flight Response:", flightState.messages[flightState.messages.length - 1].content);
    
    // Alternative: You can also test with direct parameters
    console.log("\nTesting another flight query...");
    const anotherFlightState = await app.invoke({
      messages: [
        new HumanMessage(`Please help me get flight information with these details:
        - Session ID: "00009223581026309436128527"
        - Direction: A (arrival)
        - Travel Date: 20250701
        - Airport: SIA
        - Flight: AC1804`)
      ],
    });
    
    console.log("Another Flight Response:", anotherFlightState.messages[anotherFlightState.messages.length - 1].content);
    
  } catch (error) {
    console.error("Error setting up agent:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Stack:", error.stack);
    }
  }
}

// Run the agent setup
setupAgent();