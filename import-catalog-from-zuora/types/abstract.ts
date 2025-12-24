export type QueryResponse<T extends string, N extends object> = {
  data?: {
    [k in T]?: {
      edges: [
        {
          node: N;
        }
      ];
    };
  };
  errors?: unknown;
};

export type EntityResponse<T extends string, E extends object> = {
  data?: {
    [k in T]?: E;
  };
  errors?: unknown;
};

export type EntityInput<T extends string, E extends object> = {
  input: {
    [k in T]: E;
  };
};
