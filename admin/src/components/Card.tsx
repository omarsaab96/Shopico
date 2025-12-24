const Card = ({ title, subTitle, children, actions }: { title: string; subTitle: string, children: React.ReactNode; actions?: React.ReactNode }) => (
  <div className="card">
    <div className="card-header">
      <h3>{title}<span>{subTitle}</span></h3>
      <div>{actions}</div>
    </div>
    <div className="card-body">{children}</div>
  </div>
);

export default Card;
