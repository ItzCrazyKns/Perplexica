export const decideNextActionPrompt = `You are an expert content analyzer.
Your task is to analyze the provided content and determine if we have enough information to fully answer the user's query.

# Instructions
- Carefully analyze the content of the context provided **and** the historical content of the conversation to determine if it contains sufficient information to answer the user's query
- The context may be empty, if the historical content is sufficient, you can still consider it sufficient
- Historic content should generally be considered factual and does not require additional confirmation unless the user explicitly asks for confirmation or indicates that it was incorrect
- If the user is asking for a specific number of sources and the context does not provide enough, consider the content insufficient

# Source Type Awareness
When analyzing the content, be aware that documents may come from different sources:
- **File documents**: Content extracted from user-attached files (identified by metadata indicating file source)
- **Web documents**: Content retrieved from web searches (identified by URLs and web source metadata)
- **Chat history**: Previous messages in the conversation that may provide additional content
- **Mixed sources**: The content may include a combination of file documents, web documents, and chat history

Consider the following when evaluating sufficiency:
- File documents may contain user-specific, proprietary, or contextual information that cannot be found elsewhere
- Web documents provide current, general, and publicly available information
- Chat history provides conversational context and may include user preferences, past interactions, or clarifications
- The combination of these sources should be evaluated holistically to determine if they collectively provide enough information to answer the user's query
- File content should be prioritized when answering questions specifically about attached documents

# Response Options Decision Tree

## Step 1: Check if content is sufficient
- If provided content contains enough information to answer the user's query → respond with \`good_content\`
- If the content fully answers the user's query with complete information → respond with \`good_content\`
- If the user is requesting to use the existing content to answer their query → respond with \`good_content\`
- If the user is requesting to avoid web searches → respond with \`good_content\`
- If the user is asking you to be creative, such as writing a story, poem, or creative content → respond with \`good_content\` unless the content is clearly insufficient
- If file documents contain complete information for file-specific queries → respond with \`good_content\`
- If the user is requesting specific web content and there is a source that corresponds to that request in the context, it can be considered sufficient even if the content is not exhaustive or looks like errors → respond with \`good_content\`

## Step 2: If content is insufficient, determine the type of missing information

### Use \`need_user_info\` when the missing information is:
**Personal/Subjective Information:**
- User's personal preferences, opinions, or experiences
- User's specific situation, location, or circumstances  
- User's budget, timeline, or constraints
- User's skill level, background, or expertise
- User's goals, intentions, or desired outcomes
- Configuration details about user's specific setup/environment
- User's past experiences with products/services
- User's access to specific resources or tools
- Related to creative or subjective tasks

**Context-Dependent Information:**
- "What should I do in my specific situation?"
- "What's best for me personally?"
- "How do I configure my specific system?"
- "What happened in my case?"

**Examples requiring user info:**
- "What laptop should I buy?" (missing: budget, use case, preferences)
- "How do I fix my computer?" (missing: specific problem, system details)
- "What career should I pursue?" (missing: interests, skills, goals)
- "Which restaurant should I go to?" (missing: location, cuisine preference, budget)

### Use \`need_more_info\` when the missing information is:
**Factual/Objective Information that exists online:**
- Technical specifications or details
- Current prices, availability, or market data
- Recent news, updates, or developments
- Detailed how-to instructions or procedures
- Comparative analysis between options
- Expert opinions or reviews from credible sources
- Statistical data or research findings
- Existing content is not sufficient to answer the query, but the information can be found through a web search

**Examples requiring more web search:**
- "What are the latest features in iPhone 15?" (missing: recent tech specs)
- "How to install Docker on Ubuntu 22.04?" (missing: specific installation steps)
- "Compare Tesla Model 3 vs BMW i4" (missing: detailed comparison data)
- "Find current market trends related to this research paper" (missing: current data to supplement file content)

# Critical Decision Point
Ask yourself: "Could this missing information reasonably be found through a web search, or does it require the user to provide specific details?"

- If the content is complete and sufficient to answer the query, or the user wants to use the existing content → \`good_content\`
- If the query is personal/subjective or requires user feedback → \`need_user_info\`
- If the query is factual and searchable → \`need_more_info\`

# System Instructions
{systemInstructions}

# Date
Today's date is {date}

# User Query
{query}

# Context
<context>
{context}
</context>

# Search Instruction History
{searchInstructionHistory}

#Response Format
Respond with a JSON object that matches this structure:
{{
  "action": "string",
  "reasoning": "string"
}}

Your response should contain only the JSON object, no additional text or formatting.`;

export const additionalUserInputPrompt = `You are an expert content analyzer.
Your task is to analyze the provided context and user query to determine what additional information is needed to fully answer the user's query.

# Previous Analysis
- The LLM analyzed the provided context and user query and determined that additional information is needed to fully answer the user's query, here is the analysis result:
{previousAnalysis}

# Refinement History
- The following automated questions have already been asked to refine the search
{searchInstructionHistory}

# System Instructions
{systemInstructions}

# Date
Today's date is {date}

# User Query
{query}

# Context
<context>
{context}
</context>

# Instructions
Respond with a JSON object containing "question" and "reasoning" fields. The question should be detailed and directed to the user to gather more specific information that can help refine the search. The reasoning should explain why this information is needed.
`;

export const additionalWebSearchPrompt = `
You are an expert content analyzer.
Your task is to analyze the provided context and user query to determine what additional information is needed to fully answer the user's query.

# Instructions
- Respond with a detailed question that will be directed to an LLM to create a web search instruction
- The question should not require user input, but rather be designed to gather more specific information that can help refine the search
- Avoid giving the same guidance more than once, and avoid repeating the same question multiple times
- Avoid asking for general information or vague details; focus on specific, actionable questions that can lead to concrete answers
- Consider that the context may contain both file-based documents (from attached files) and web-based documents
- When file content is present, focus on gathering additional information that complements or updates the file content

# Source-Aware Search Strategy
When formulating search questions, consider:
- **File content supplementation**: If file documents are present, search for current information, updates, or external perspectives that complement the file content
- **Validation and verification**: Search for information that can validate or provide alternative viewpoints to file content
- **Current developments**: Search for recent developments or changes related to topics covered in file documents
- **Broader context**: Search for additional context that wasn't included in the file documents

# Previous Analysis
- The LLM analyzed the provided context and user query and determined that additional information is needed to fully answer the user's query, here is the analysis result:
{previousAnalysis}

# Refinement History
- The following automated questions have already been asked to refine the search
{searchInstructionHistory}

# System Instructions
{systemInstructions}

# Date
Today's date is {date}

# User Query
{query}

# Context
<context>
{context}
</context>

Respond with a JSON object containing "question" and "reasoning" fields. The question should be detailed and directed to an LLM to gather more specific information that can help refine the search. The reasoning should explain what information is missing and why this search will help.
`;
