import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  description?: string;
  leader: mongoose.Types.ObjectId; // Reference to User (team leader)
  members: mongoose.Types.ObjectId[]; // Array of User references (team members)
  createdBy: mongoose.Types.ObjectId; // Admin/HR who created the team
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    leader: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure leader is included in members array
TeamSchema.pre('save', function (next) {
  const team = this as unknown as ITeam;
  if (team.leader) {
    const leaderId = String(team.leader);
    const members = (team.members || []) as mongoose.Types.ObjectId[];
    const memberIds = members.map((id) => String(id));
    if (!memberIds.includes(leaderId)) {
      team.members.push(team.leader);
    }
  }
  next();
});

// Register the model, reusing existing if available
let Team: Model<ITeam>;
try {
  Team = mongoose.models.Team as Model<ITeam>;
  if (!Team) {
    Team = mongoose.model<ITeam>('Team', TeamSchema);
  }
} catch (error) {
  if (mongoose.models.Team) {
    delete mongoose.models.Team;
    if ((mongoose as any).modelSchemas && (mongoose as any).modelSchemas.Team) {
      delete (mongoose as any).modelSchemas.Team;
    }
  }
  Team = mongoose.model<ITeam>('Team', TeamSchema);
}

export default Team;

