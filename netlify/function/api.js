// This is a placeholder - you'll need to convert your Flask routes to serverless functions
// OR deploy Flask backend separately

export const handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "API endpoint - deploy Flask backend separately" }),
  };
};