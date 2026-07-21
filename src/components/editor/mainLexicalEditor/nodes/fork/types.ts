import type { SerializedElementNode, SerializedLexicalNode, Spread } from "lexical";

export type SerializedForkGroupNode = Spread<
    {
        type: "fork-group";
        forkId: string;
        activeBranchKey: string;
        label?: string;
        version: 1;
    },
    SerializedElementNode
>;

export type SerializedForkBranchNode = Spread<
    {
        type: "fork-branch";
        branchKey: string;
        title: string;
        active: boolean;
        version: 1;
    },
    SerializedElementNode
>;

export type SerializedForkHeaderNode = Spread<
    {
        type: "fork-header";
        version: 1;
    },
    SerializedLexicalNode
>;
